import Elysia from 'elysia';
import type {
  ChannelName,
  GameEventPayload,
  IGameManager,
  IProcessManager,
  OnlinePlayer,
  WSEnvelope,
} from '@fxmanager/types';
import type { ServerState, ConsoleOutputEvent } from '@fxmanager/types';
import { repo } from '@fxmanager/database';

/* ToDo:
 * Consider a refactor, notably to store data client side (i.e. online player list / console output)
 */

type SocketData = { _subs: Map<ChannelName, () => void> };

function envelope(channel: ChannelName, type: string, payload: unknown): string {
  return JSON.stringify({
    channel,
    type,
    payload,
    ts: Date.now(),
  } satisfies WSEnvelope);
}

function subscribeServerChannel(
  ws: { send: (v: string) => void },
  pm: IProcessManager,
): () => void {
  ws.send(envelope('server', 'server:status', pm.getState()));

  const onState = (state: ServerState) => {
    ws.send(envelope('server', 'server:status', state));
  };

  pm.on('state', onState);
  return () => pm.off('state', onState);
}

function subscribeConsoleChannel(
  ws: { send: (v: string) => void },
  pm: IProcessManager,
): () => void {
  const history = pm.getConsoleContent() ?? [];
  for (const entry of history) {
    ws.send(envelope('console', 'console:output', entry));
  }

  const onConsole = (data: ConsoleOutputEvent) =>
    ws.send(envelope('console', 'console:output', data));

  pm.on('console', onConsole);
  return () => pm.off('console', onConsole);
}

function subscribePlayerlistChannel(
  ws: { send: (v: string) => void },
  pm: IProcessManager,
  gm: IGameManager,
): () => void {
  console.log('sending player list snapshot:', gm.getPlayerList());
  ws.send(envelope('playerlist', 'playerlist:snapshot', gm.getPlayerList()));

  const onPlayers = (payload: GameEventPayload) => {
    console.log('Handling onPlayers', payload);
    if (payload.event === 'player.join')
      ws.send(envelope('playerlist', 'playerlist:join', payload.data));
    else if (payload.event === 'player.drop')
      ws.send(envelope('playerlist', 'playerlist:drop', payload.data));
    else if (payload.event === 'player.update')
      ws.send(envelope('playerlist', 'playerlist:update', payload.data));
  };

  pm.on('players', onPlayers);
  return () => pm.off('players', onPlayers);
}

function subscribeReportChannel(
  ws: { send: (v: string) => void },
  reportId: string,
  pm: IProcessManager,
): () => void {
  const channel: ChannelName = `report:${reportId}`;

  console.log('[panel] - ToDo: implement get report state in process manager');
  // const initialState = pm.getReportState?.(reportId);
  // if (initialState) ws.send(envelope(channel, 'report:state', initialState));

  const onMessage = (data: { reportId: string; message: unknown }) => {
    if (data.reportId === reportId) ws.send(envelope(channel, 'report:message', data.message));
  };

  const onStateChange = (data: { reportId: string; status: string }) => {
    if (data.reportId === reportId)
      ws.send(envelope(channel, 'report:state', { status: data.status }));
  };

  pm.on('report:message', onMessage);
  pm.on('report:state', onStateChange);

  return () => {
    pm.off('report:message', onMessage);
    pm.off('report:state', onStateChange);
  };
}

// region channel registry

function resolveChannelSubscriber(
  channel: ChannelName,
  ws: { send: (v: string) => void },
  pm: IProcessManager,
  gm: IGameManager,
): (() => void) | null {
  if (channel === 'server') return subscribeServerChannel(ws, pm);
  if (channel === 'console') return subscribeConsoleChannel(ws, pm);
  if (channel === 'playerlist') return subscribePlayerlistChannel(ws, pm, gm);
  if (channel.startsWith('report:')) {
    const reportId = channel.slice('report:'.length);
    return subscribeReportChannel(ws, reportId, pm);
  }
  return null;
}

// region elysia route

export const wsRoutes = (pm: IProcessManager, gm: IGameManager) =>
  new Elysia().ws('/ws', {
    open(ws) {
      (ws.data as unknown as SocketData)._subs = new Map();

      // Auto-subscribe all global channels on connect
      const globalChannels: ChannelName[] = ['server', 'console', 'playerlist'];
      for (const ch of globalChannels) {
        const cleanup = resolveChannelSubscriber(ch, ws, pm, gm);
        if (cleanup) (ws.data as unknown as SocketData)._subs.set(ch, cleanup);
      }
    },

    close(ws) {
      const subs = (ws.data as unknown as SocketData)._subs;
      subs?.forEach((cleanup) => cleanup());
      subs?.clear();
    },

    message(ws, msg) {
      try {
        const { channel, type, payload } = msg as WSEnvelope;
        const subs = (ws.data as unknown as SocketData)._subs;

        // ── Channel subscription management ──────────────────────────────────
        if (type === 'channel:subscribe' && !subs.has(channel)) {
          const cleanup = resolveChannelSubscriber(channel, ws, pm, gm);
          if (cleanup) subs.set(channel, cleanup);
          return;
        }

        if (type === 'channel:unsubscribe') {
          subs.get(channel)?.();
          subs.delete(channel);
          return;
        }

        // ── Inbound channel messages ──────────────────────────────────────────
        if (
          channel === 'console' &&
          type === 'console:input' &&
          pm.getState().status === 'running'
        ) {
          DEV: console.log('[panel] sending command to process', payload);
          pm.sendCommand((payload as any).command);
        }

        if (channel.startsWith('report:') && type === 'report:message') {
          const reportId = channel.slice('report:'.length);
          // pm.sendReportMessage?.(reportId, (payload as any).body);
          console.log('[panel] - ToDo: trigger process manager to update report data');
        }

        if (channel.startsWith('report:') && type === 'report:close') {
          const reportId = channel.slice('report:'.length);
          // pm.closeReport?.(reportId);
          console.log('[panel] - ToDo: trigger process manager to close report');
        }
      } catch (err) {
        console.error('[panel] Error occured within message reception of WS', err);
        /* ignore malformed */
      }
    },
  });
