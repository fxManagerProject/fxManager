import { WSUrl } from '@/lib/query';
import type { ChannelName, WSEnvelope } from '@fxmanager/types';
import { useEffect, useRef, useState, useCallback } from 'react';

type ChannelListener = (envelope: WSEnvelope) => void;

// region ws manager
// singleton shared across components
interface WSManager {
  subscribe(channel: ChannelName, fn: ChannelListener): () => void;
  send(envelope: Omit<WSEnvelope, 'ts'>): void;
  connected: boolean;
}

let manager: WSManager | null = null;
const connectionListeners: Set<(v: boolean) => void> = new Set();

function getManager(): WSManager {
  if (manager) return manager;

  const listeners = new Map<ChannelName, Set<ChannelListener>>();
  let ws: WebSocket | null = null;
  let connected = false;

  function connect() {
    const url = WSUrl();
    ws = new WebSocket(url);

    console.log('New websocket connection', url);

    ws.onopen = () => {
      connected = true;
      connectionListeners.forEach((fn) => fn(true));
    };

    ws.onclose = () => {
      connected = false;
      connectionListeners.forEach((fn) => fn(false));
      setTimeout(connect, 2000);
    };

    ws.onmessage = (e) => {
      try {
        const envelope: WSEnvelope = JSON.parse(e.data);
        const subs = listeners.get(envelope.channel);
        subs?.forEach((fn) => fn(envelope));
      } catch {
        /* ignore malformed */
      }
    };
  }

  connect();

  manager = {
    subscribe: (channel, fn) => {
      if (!listeners.has(channel)) listeners.set(channel, new Set());
      listeners.get(channel)!.add(fn);
      return () => {
        listeners.get(channel)?.delete(fn);
        if (listeners.get(channel)?.size === 0) listeners.delete(channel);
      };
    },
    send: (envelope) => {
      if (ws?.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ ...envelope, ts: Date.now() }));
      else
        console.warn(
          'Attempted to send message with WS not ready',
          ws?.readyState ?? 'no ws ready state',
        );
    },
    get connected() {
      return connected;
    },
  };

  return manager;
}

// region hook

export function usePanelWS<TState>(
  channel: ChannelName,
  reducer: (state: TState, envelope: WSEnvelope) => TState,
  initialState: TState,
) {
  const [state, setState] = useState<TState>(initialState);
  const [connected, setConnected] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const mgr = getManager();
    setConnected(mgr.connected);
    connectionListeners.add(setConnected);

    const unsub = mgr.subscribe(channel, (envelope) => {
      setState((prev) => reducer(prev, envelope));
    });

    return () => {
      unsub();
      connectionListeners.delete(setConnected);
    };

    // reducer intentionally omitted — callers should memoize or define outside
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const send = useCallback(
    (type: string, payload: unknown) => {
      getManager().send({ channel, type, payload });
    },
    [channel],
  );

  return { state, connected, send };
}
