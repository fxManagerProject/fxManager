import type { EventEmitter } from 'events';
import type { ConsoleOutputEvent } from './socket';
import type { GameEventPayload } from './game-api';

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed';

export interface ServerState {
  status: ServerStatus;
  pid?: number;
  startedAt?: Date;
  restarts: number;
  playerCount: number;
  lastCrashAt?: Date;
}

export interface ServerConfig {
  version: `${string}.${string}.${string}` | `${string}.${string}.${string}-b` | 'dev-build';
  executable: string;
  serverDataPath: string;
  configFile: string;
  autoRestart: boolean;
  maxRestarts: number;
  restartDelayMs: number;
  webServerPort: number;
  internalPort: number;
  resourceApiToken: string;
}

export interface IProcessManager extends EventEmitter {
  getState(): ServerState;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  sendCommand(command: string): void;
  getConsoleContent(): ConsoleOutputEvent[];
  handleGameEvent(payload: GameEventPayload): void;
}
