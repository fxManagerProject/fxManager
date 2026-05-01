import { repo } from '@fxmanager/database';
import type { CoreConfig, PlatformOS } from '@fxmanager/shared/types';
import crypto from 'node:crypto';

interface CoreSettings extends CoreConfig {
	onesync: 'on' | 'legacy' | 'off';
	executable: string;
	serverDataPath: string;
	serverConfigFile: string;
	[key: string]: any;
}

export class ConfigManager {
  private static instance: ConfigManager | null = null;
	private systemValues: CoreConfig = {
		platform: (process.platform === 'win32'
			? 'windows'
			: 'linux') as PlatformOS,
		webServerPort: process.env.PANEL_PORT
			? Number(process.env.PANEL_PORT)
			: 3000,
		resourceApiToken: crypto.randomUUID(),
		cookieSecret: process.env.COOKIE_SECRET ?? crypto.randomUUID(),
	};

  private constructor() {}

  static getInstance() {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }

    return ConfigManager.instance;
  }

	regenerateApiToken() {
		this.systemValues.resourceApiToken = crypto.randomUUID();
	}

	async load(skipDb: true): Promise<CoreConfig>;
	async load(skipDb?: false): Promise<CoreSettings>;
	async load(
		skipDb: boolean = false,
	): Promise<CoreSettings | CoreConfig> {
		if (skipDb) return { ...this.systemValues };

		const dbEntries = repo.settings.all();

		const persistent = dbEntries.reduce((acc, curr) => {
			acc[curr.key] = curr.value;
			return acc;
		}, {} as any);

		return {
			executable: './FXServer',
			serverDataPath: './server-data',
			serverConfigFile: 'server.cfg',
			onesync: 'on',

			...persistent,
			...this.systemValues,
		};
	}
}
