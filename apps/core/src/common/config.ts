import type { CoreConfig, PlatformOS } from '@fxmanager/shared/types';
import { repo } from '@fxmanager/database';

function getPlatform(): PlatformOS {
	if (process.platform === 'win32') {
		return 'windows';
	} else if (process.platform === 'linux' || process.platform === 'darwin') {
		return 'linux';
	} else {
		return 'unknown';
	}
}

const DEFAULTS: CoreConfig = {
	platform: getPlatform(),
  executable: './FXServer',
  serverDataPath: './server-data',
  configFile: 'server.cfg',
  autoRestart: true,
  maxRestarts: 5,
  restartDelayMs: 5000,
  webServerPort: process.env.PANEL_PORT ? Number(process.env.PANEL_PORT) : 4000,
  // used for fxserver resource -> process manager communications
  resourceApiToken: crypto.randomUUID(),
};

export function loadConfig(): CoreConfig {
  const stored = repo.settings.get<Partial<CoreConfig>>('server.config');
  return { ...DEFAULTS, ...stored };
}

export function saveConfig(config: Partial<CoreConfig>) {
  repo.settings.set('server.config', config);
}
