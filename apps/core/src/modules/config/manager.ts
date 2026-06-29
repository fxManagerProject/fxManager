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

const fxServerSettingsMap = {
	'fxserver.onesync': 'onesync',
	'fxserver.executablePath': 'executablePath',
	'fxserver.serverDataPath': 'serverDataPath',
	'fxserver.serverConfigPath': 'serverConfigFile',
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
		executablePath: process.env.FXSERVER_EXECUTABLE || './FXServer',
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

		const dbValues = repo.settings.getMultiple([
			'fxserver.onesync',
			'fxserver.executablePath',
			'fxserver.serverDataPath',
			'fxserver.serverConfigPath',
		]);

		const valuesToEnv = {
			'fxserver.executablePath': 'FXSERVER_EXECUTABLE',
			'fxserver.serverDataPath': 'FXSERVER_DATA_PATH',
			'fxserver.serverConfigPath': 'FXSERVER_CFG',
		};

		Object.keys(valuesToEnv).forEach((key) => {
			const envVar = valuesToEnv[key as keyof typeof valuesToEnv];
			if (!dbValues[key as keyof typeof dbValues] && process.env[envVar]) {
				repo.settings.set(key, process.env[envVar]);
			}
		});

		const persistent = Object.entries(dbValues).reduce(
			(acc, [key, value]) => {
				if (value !== undefined) {
					const mappedKey =
						fxServerSettingsMap[key as keyof typeof fxServerSettingsMap];
					acc[mappedKey] = value;
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
