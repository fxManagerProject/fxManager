import type { EventEmitter } from 'events';
import { ConsoleOutputEvent } from './socket';

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed';

export interface ServerState {
  status: ServerStatus;
  pid?: number;
  startedAt?: Date;
  restarts: number;
  lastCrashAt?: Date;
}

export interface ServerConfig {
  executable: string;
  serverDataPath: string;
  configFile: string;
  autoRestart: boolean;
  maxRestarts: number;
  restartDelayMs: number;
  webServerPort: number;
  internalPort: number;
}

export interface IProcessManager extends EventEmitter {
  getState(): ServerState;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  sendCommand(command: string): void;
  getConsoleContent(): ConsoleOutputEvent[];
}
