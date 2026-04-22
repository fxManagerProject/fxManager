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

export function WSProvider({ children }: { children: ReactNode }) {
	const { user } = useAuth();
	const [connected, setConnected] = useState(false);
	const socketRef = useRef<WebSocket | null>(null);
	// handlers keyed by `channel:event`
	const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
	const pendingRef = useRef<Set<Channel>>(new Set()); // subscriptions before connect

	const send = useCallback((payload: object) => {
		if (socketRef.current?.readyState === WebSocket.OPEN) {
			socketRef.current.send(JSON.stringify(payload));
		}
	}, []);

	const subscribe = useCallback(
		(channel: Channel) => {
			if (socketRef.current?.readyState === WebSocket.OPEN) {
				send({ type: 'subscribe', channel });
			} else {
				pendingRef.current.add(channel);
			}
		},
		[send],
	);

	const unsubscribe = useCallback(
		(channel: Channel) => {
			pendingRef.current.delete(channel);
			send({ type: 'unsubscribe', channel });
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
			handlersRef.current.get(key)!.add(handler as MessageHandler);

			return () => {
				handlersRef.current.get(key)?.delete(handler as MessageHandler);
			};
		},
		[],
	);

	useEffect(() => {
		if (!user) {
			if (socketRef.current) {
				socketRef.current.close();
				socketRef.current = null;
				setConnected(false);
			}

			return;
		}

		if (socketRef.current) return;

		console.log('WSUrl', WSUrl());
		const ws = new WebSocket(WSUrl());
		socketRef.current = ws;

		ws.onopen = () => {
			setConnected(true);
			// Flush subscriptions that were registered before the socket connected
			for (const channel of pendingRef.current) {
				ws.send(JSON.stringify({ type: 'subscribe', channel }));
			}
			pendingRef.current.clear();
		};

		ws.onclose = () => setConnected(false);

		ws.onmessage = (event) => {
			try {
				const msg: WSMessage = JSON.parse(event.data);
				const key = `${msg.channel}:${msg.event}`;
				handlersRef.current.get(key)?.forEach((h) => h(msg));
			} catch {}
		};

		return () => {
			socketRef.current?.close();
			socketRef.current = null;
			setConnected(false);
		};
	}, [user]);

	const emit = useCallback(
		<T,>(channel: Channel, event: string, data: T) => {
			if (socketRef.current?.readyState === WebSocket.OPEN) {
				socketRef.current.send(
					JSON.stringify({ type: 'emit', channel, event, data }),
				);
			} else {
				console.warn(
					`[ws] Cannot emit — not connected (channel: ${channel}, event: ${event})`,
				);
			}
		},
		[user],
	);

	return (
		<WSContext.Provider value={{ subscribe, unsubscribe, on, emit, connected }}>
			{children}
		</WSContext.Provider>
	);
}
