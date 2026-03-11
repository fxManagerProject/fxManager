import type { ServerConfig } from '@fxmanager/types';
import { repo } from '@fxmanager/database';

const DEFAULTS: ServerConfig = {
  executable: process.env.FIVEM_EXECUTABLE ?? './FXServer',
  serverDataPath: process.env.FIVEM_DATA_PATH ?? './server-data',
  configFile: process.env.FIVEM_CFG ?? 'server.cfg',
  autoRestart: true,
  maxRestarts: 5,
  restartDelayMs: 5000,
  webServerPort: process.env.PANEL_PORT ? Number(process.env.PANEL_PORT) : 4000,
  // used for fxserver resource -> process manager communications
  internalPort: 4005,
};

export function loadConfig(): ServerConfig {
  const stored = repo.settings.get<Partial<ServerConfig>>('server.config');
  return { ...DEFAULTS, ...stored };
}

export function saveConfig(config: Partial<ServerConfig>) {
  repo.settings.set('server.config', config);
}
