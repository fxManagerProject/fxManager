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
	executable: process.env.FXSERVER_EXECUTABLE || './FXServer',
	serverDataPath: process.env.FXSERVER_DATA_PATH || './server-data',
	configFile: process.env.FXSERVER_CFG || 'server.cfg',
	autoRestart: true,
	maxRestarts: 5,
	restartDelayMs: 5000,
	webServerPort: process.env.PANEL_PORT ? Number(process.env.PANEL_PORT) : 3000,
	// used for fxserver resource -> process manager communications
	resourceApiToken: crypto.randomUUID(),
	cookieSecret: process.env.COOKIE_SECRET ?? crypto.randomUUID(),
};

export function loadConfig(): CoreConfig {
	const stored = repo.settings.get<Partial<CoreConfig>>('server.config');
	return { ...DEFAULTS, ...stored };
}

export function saveConfig(config: Partial<CoreConfig>) {
	repo.settings.set('server.config', config);
}
