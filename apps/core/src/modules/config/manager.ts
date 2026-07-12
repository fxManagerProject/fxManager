import crypto from 'node:crypto';
import path from 'node:path';
import { stat } from 'node:fs/promises';
import { repo } from '@fxmanager/database';
import type {
	CoreConfig,
	PlatformOS,
	ServerConfig,
} from '@fxmanager/shared/types';
import { resolveAutostartEnabled } from '../process/autostart';
import { cwd } from 'node:process';

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

	isAutostartEnabled(): boolean {
		return resolveAutostartEnabled(
			repo.settings.get('fxserver.autostart'),
			process.env.FXSERVER_AUTOSTART,
		);
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

		const persistent = dbEntries.reduce(
			(acc, curr) => {
				acc[curr.key] = curr.value;
				return acc;
			},
			{} as Record<string, unknown>,
		);

		return {
			...this.fxServerValues,
			...persistent,
			...this.systemValues, // System values should override everything else
		};
	}

	async validateExecutablePath(
		executableInput: string,
	): Promise<{ valid: boolean; path: string }> {
		const initialPath = path.isAbsolute(executableInput)
			? executableInput
			: path.join(cwd(), executableInput);

		let finalPath = initialPath;
		let found = false;

		try {
			const execStats = await stat(initialPath);

			if (execStats.isDirectory()) {
				const validNames =
					process.platform === 'win32'
						// cover both as a sanity check
						? ['fxserver.exe', 'FXServer.exe']
						// should only be FXServer, but just in case we do both
						: ['fxserver', 'FXServer'];

				for (const name of validNames) {
					const testPath = path.join(initialPath, name);
					try {
						const testStats = await stat(testPath);
						if (testStats.isFile()) {
							finalPath = testPath;
							found = true;
							break;
						}
					} catch {}
				}
			} else if (execStats.isFile()) {
				const fileName = path.basename(initialPath);
				const validNames =
					process.platform === 'win32'
						? /^fxserver\.exe$/i
						: /^(fxserver|FXServer)$/;

		    if (validNames.test(fileName)) {
	        found = true;
		    }
			}
		} catch {
			found = false;
		}

		return { valid: found, path: finalPath };
	}

	async validateDataPath(
		dataInput: string,
	): Promise<{ valid: boolean; path: string }> {
		const dataPath = path.isAbsolute(dataInput)
			? dataInput
			: path.join(cwd(), dataInput);

		let valid = false;
		try {
			const stats = await stat(dataPath);
			valid = stats.isDirectory();
		} catch {
			valid = false;
		}

		return { valid, path: dataPath };
	}

	async validateConfigPath(
		configInput: string,
		providedDataPath?: string,
	): Promise<{ valid: boolean; path: string }> {
		const dataPath =
			providedDataPath || this.getFxServerValues().serverDataPath;

		const cfgPath = path.isAbsolute(configInput)
			? configInput
			: path.join(dataPath, configInput);

		let valid = false;
		try {
			const stats = await stat(cfgPath);
			const isCfg = path.extname(cfgPath) === '.cfg';
			valid = stats.isFile() && isCfg;
		} catch {
			valid = false;
		}

		return { valid, path: cfgPath };
	}

	async checkFXServerPaths(
		executableInput: string,
		serverDataInput: string,
	): Promise<{
		files: { executable: string; serverdata: string; cfg: string };
		exists: { executable: boolean; serverdata: boolean; cfg: boolean };
	}> {
		const execResult = await this.validateExecutablePath(executableInput);
		const dataResult = await this.validateDataPath(serverDataInput);

		const cfgInput = this.getFxServerValues().serverConfigFile;
		const cfgResult = await this.validateConfigPath(cfgInput, dataResult.path);

		return {
			files: {
				executable: execResult.path,
				serverdata: dataResult.path,
				cfg: cfgResult.path,
			},
			exists: {
				executable: execResult.valid,
				serverdata: dataResult.valid,
				cfg: cfgResult.valid,
			},
		};
	}
}
