import { useEffect, useRef, useState, useCallback } from 'react';
import type { WSEvent, ServerState, ConsoleOutputEvent } from '@fxmanager/types';

interface PanelWSState {
  serverState: ServerState | null;
  consoleLogs: ConsoleOutputEvent[];
  connected: boolean;
}

export function usePanelWS() {
  const ws = useRef<WebSocket | null>(null);
  const [state, setState] = useState<PanelWSState>({
    serverState: null,
    consoleLogs: [],
    connected: false,
  });

  useEffect(() => {
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    ws.current = new WebSocket(url);

    ws.current.onopen = () => setState((s) => ({ ...s, connected: true }));
    ws.current.onclose = () => setState((s) => ({ ...s, connected: false }));

    ws.current.onmessage = (e) => {
      const event: WSEvent = JSON.parse(e.data);
      if (event.type === 'server:status') {
        setState((s) => ({ ...s, serverState: event.payload as ServerState }));
      } else if (event.type === 'console:output') {
        setState((s) => ({
          ...s,
          consoleLogs: [...s.consoleLogs.slice(-500), event.payload as ConsoleOutputEvent],
        }));
      }
    };

    return () => ws.current?.close();
  }, []);

  const sendCommand = useCallback((command: string) => {
    ws.current?.send(JSON.stringify({ type: 'console:input', payload: { command } }));
  }, []);

  return { ...state, sendCommand };
}
