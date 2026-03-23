import type {
  ServerState,
  ConsoleOutputEvent,
  WSEnvelope,
  ReportMessage,
  ReportStatus,
  OnlinePlayer,
} from '@fxmanager/types';
import { usePanelWS } from './use-websocket';

/* ToDo:
 * Consider a refactor, notably to store data client side (i.e. online player list / console output)
 */

// region server status

interface ServerChannelState {
  serverState: ServerState | null;
}

function serverStateReducer(state: ServerChannelState, env: WSEnvelope): ServerChannelState {
  if (env.type === 'server:status') return { serverState: env.payload as ServerState };
  return state;
}

export function useServerStateSocket() {
  return usePanelWS('server', serverStateReducer, { serverState: null });
}

// region console

interface ConsoleChannelState {
  logs: ConsoleOutputEvent[];
}

function consoleReducer(state: ConsoleChannelState, env: WSEnvelope): ConsoleChannelState {
  if (env.type === 'console:history') {
    return { logs: env.payload as ConsoleOutputEvent[] };
  }
  if (env.type === 'console:output') {
    return { logs: [...state.logs.slice(-500), env.payload as ConsoleOutputEvent] };
  }
  return state;
}

export function useConsoleSocket() {
  const { state, connected, send } = usePanelWS('console', consoleReducer, { logs: [] });

  const sendCommand = (command: string) => send('console:input', { command });

  return { logs: state.logs, connected, sendCommand };
}

// region player list

interface PlayerlistChannelState {
  players: OnlinePlayer[];
  ready: boolean;
}

function playerlistReducer(state: PlayerlistChannelState, env: WSEnvelope): PlayerlistChannelState {
  console.log('playerlistReducer', state, env);
  switch (env.type) {
    case 'playerlist:snapshot':
      return { players: env.payload as OnlinePlayer[], ready: true };

    case 'playerlist:join':
      return { ...state, players: [...state.players, env.payload as OnlinePlayer] };

    case 'playerlist:drop': {
      const { serverId } = env.payload as { serverId: number };
      return { ...state, players: state.players.filter((p) => p.serverId !== serverId) };
    }

    case 'playerlist:update': {
      const updated = env.payload as Partial<OnlinePlayer> & { serverId: number };
      return {
        ...state,
        players: state.players.map((p) =>
          p.serverId === updated.serverId ? { ...p, ...updated } : p,
        ),
      };
    }

    default:
      return state;
  }
}

export function usePlayerlistSocket() {
  return usePanelWS('playerlist', playerlistReducer, { players: [], ready: false });
}

// region report

interface ReportState {
  status: ReportStatus | null;
  messages: ReportMessage[];
}

function reportReducer(state: ReportState, env: WSEnvelope): ReportState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (env.type === 'report:state') return { ...state, status: (env.payload as any).status };
  if (env.type === 'report:message') {
    return { ...state, messages: [...state.messages, env.payload as ReportMessage] };
  }
  return state;
}

export function useReportSocket(reportId: string) {
  const channel = `report:${reportId}` as const;
  const { state, connected, send } = usePanelWS(channel, reportReducer, {
    status: null,
    messages: [],
  });

  const sendMessage = (body: string) => send('report:message', { body });
  const closeReport = () => send('report:close', {});

  return { ...state, connected, sendMessage, closeReport };
}
