import { repo } from '@fxmanager/database';
import type {
	CoreConfig,
	PlatformOS,
	ServerConfig,
} from '@fxmanager/shared/types';
import crypto from 'node:crypto';

type CoreSettings = CoreConfig &
	ServerConfig & {
		[key: string]: any;
	};

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

	private fxServerValues: ServerConfig = {
		onesync: 'on',
		executable: process.env.FXSERVER_EXECUTABLE || './FXServer',
		serverDataPath: process.env.FXSERVER_DATA_PATH || './server-data',
		serverConfigFile: process.env.FXSERVER_CFG || 'server.cfg',
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

	getSystemValues() {
		return this.systemValues;
	}

	getFxServerValues(useDb: boolean = false) {
		if (!useDb) return this.fxServerValues;

		const dbValues = repo.settings.getMultiple(
			Object.keys(this.fxServerValues),
		);

		const persistent = Object.entries(dbValues).reduce(
			(acc, [key, value]) => {
				if (value !== undefined) {
					acc[key] = value;
				}
				return acc;
			},
			{} as Record<string, string>,
		);

		return { ...this.fxServerValues, ...persistent };
	}

	getAllValues(useDb: boolean = false): CoreSettings {
		if (!useDb) return { ...this.fxServerValues, ...this.systemValues };

		const dbEntries = repo.settings.all();

		const persistent = dbEntries.reduce((acc, curr) => {
			acc[curr.key] = curr.value;
			return acc;
		}, {} as any);

		return {
			...this.fxServerValues,
			...persistent,
			...this.systemValues, // System values should override everything else
		};
	}
}
