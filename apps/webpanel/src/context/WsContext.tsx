import { useAuth } from '@/hooks/use-auth';
import { WSContext } from '@/hooks/ws-channels/use-ws-core';
import { WSUrl } from '@/lib/query';
import type { MessageHandler } from '@/types/ws';
import type { Channel, WSMessage } from '@fxmanager/shared/types';
import {
	useEffect,
	useRef,
	useState,
	useCallback,
	type ReactNode,
} from 'react';

const RECONNECT_MIN_MS = 500;
const RECONNECT_MAX_MS = 10_000;

export function WSProvider({ children }: { children: ReactNode }) {
	const { user } = useAuth();
	const [connected, setConnected] = useState(false);
	const socketRef = useRef<WebSocket | null>(null);
	// handlers keyed by `channel:event`
	const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
	// refcounted subscriptions, replayed on reconnect
	const subsRef = useRef<Map<Channel, number>>(new Map());

	useEffect(() => {
		if (!user) return;

		let disposed = false;
		let retryDelay = RECONNECT_MIN_MS;
		let retryTimer: ReturnType<typeof setTimeout> | undefined;

		const connect = () => {
			const ws = new WebSocket(WSUrl());
			socketRef.current = ws;

			ws.onopen = () => {
				retryDelay = RECONNECT_MIN_MS;
				setConnected(true);
				for (const channel of subsRef.current.keys()) {
					ws.send(JSON.stringify({ type: 'subscribe', channel }));
				}
			};

			ws.onclose = () => {
				// A stale socket's close can arrive after a newer one took over
				if (socketRef.current === ws) socketRef.current = null;
				if (disposed) return;
				setConnected(false);
				retryTimer = setTimeout(connect, retryDelay);
				retryDelay = Math.min(retryDelay * 2, RECONNECT_MAX_MS);
			};

			ws.onmessage = (event) => {
				try {
					const msg: WSMessage = JSON.parse(event.data);
					const key = `${msg.channel}:${msg.event}`;
					handlersRef.current.get(key)?.forEach((h) => {
						h(msg);
					});
				} catch {}
			};
		};

		connect();

		return () => {
			disposed = true;
			clearTimeout(retryTimer);
			socketRef.current?.close();
			socketRef.current = null;
			setConnected(false);
		};
	}, [user]);

	const send = useCallback((payload: object) => {
		if (socketRef.current?.readyState === WebSocket.OPEN) {
			socketRef.current.send(JSON.stringify(payload));
		}
	}, []);

	const subscribe = useCallback(
		(channel: Channel) => {
			const count = subsRef.current.get(channel) ?? 0;
			subsRef.current.set(channel, count + 1);
			send({ type: 'subscribe', channel });
		},
		[send],
	);

	const unsubscribe = useCallback(
		(channel: Channel) => {
			const count = subsRef.current.get(channel) ?? 0;
			if (count <= 1) {
				subsRef.current.delete(channel);
				send({ type: 'unsubscribe', channel });
			} else {
				subsRef.current.set(channel, count - 1);
			}
		},
		[send],
	);

	const on = useCallback(
		<T,>(
			channel: Channel,
			event: string,
			handler: MessageHandler<T>,
		): (() => void) => {
			const key = `${channel}:${event}`;
			if (!handlersRef.current.has(key)) {
				handlersRef.current.set(key, new Set());
			}
			handlersRef.current.get(key)?.add(handler as MessageHandler);

			return () => {
				handlersRef.current.get(key)?.delete(handler as MessageHandler);
			};
		},
		[],
	);

	const emit = useCallback(<T,>(channel: Channel, event: string, data: T) => {
		if (socketRef.current?.readyState === WebSocket.OPEN) {
			socketRef.current.send(
				JSON.stringify({ type: 'emit', channel, event, data }),
			);
		} else {
			console.warn(
				`[ws] Cannot emit — not connected (channel: ${channel}, event: ${event})`,
			);
		}
	}, []);

	return (
		<WSContext.Provider value={{ subscribe, unsubscribe, on, emit, connected }}>
			{children}
		</WSContext.Provider>
	);
}
