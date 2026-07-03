import path from 'node:path';
import { ConfigManager } from './manager';

export function resolveCfgContext(): { dataDir: string; entryCfgPath: string } {
	const cfg = ConfigManager.getInstance().getFxServerValues(true);
	const dataDir = path.resolve(cfg.serverDataPath);
	const entryCfgPath = path.isAbsolute(cfg.serverConfigFile)
		? cfg.serverConfigFile
		: path.join(dataDir, cfg.serverConfigFile);
	return { dataDir, entryCfgPath };
}
