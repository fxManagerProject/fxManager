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
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isConnecting = false; // guard against overlapping connect calls

function getManager(): WSManager {
  if (manager) return manager;

  const listeners = new Map<ChannelName, Set<ChannelListener>>();
  let ws: WebSocket | null = null;
  let connected = false;

  function connect() {
    if (isConnecting) return; // prevent overlapping attempts
    isConnecting = true;

    const url = WSUrl();
    console.log('[ws] Connecting to', url);
    ws = new WebSocket(url);

    ws.onopen = () => {
      isConnecting = false;
      connected = true;
      connectionListeners.forEach((fn) => fn(true));
    };

    ws.onerror = (ev) => {
      // onclose always fires after onerror, so just log here
      console.warn('[ws] Connection error', ev);
    };

    ws.onclose = () => {
      isConnecting = false;
      connected = false;
      connectionListeners.forEach((fn) => fn(false));

      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 2000);
    };

    ws.onmessage = (e) => {
      try {
        const envelope: WSEnvelope = JSON.parse(e.data);
        listeners.get(envelope.channel)?.forEach((fn) => fn(envelope));
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
      else console.warn('[ws] Send attempted while not connected, state:', ws?.readyState);
    },
    get connected() {
      return connected;
    },
  };

  return manager;
}

// Prevent HMR from spawning duplicate reconnect loops
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    manager = null;
    isConnecting = false;
  });
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
