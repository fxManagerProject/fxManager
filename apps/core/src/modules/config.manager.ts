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
	private static systemValues: CoreConfig = {
		platform: (process.platform === 'win32'
			? 'windows'
			: 'linux') as PlatformOS,
		webServerPort: process.env.PANEL_PORT
			? Number(process.env.PANEL_PORT)
			: 3000,
		resourceApiToken: crypto.randomUUID(),
		cookieSecret: process.env.COOKIE_SECRET ?? crypto.randomUUID(),
	};

	static regenerateApiToken() {
		this.systemValues.resourceApiToken = crypto.randomUUID();
	}

	static async load(skipDb: true): Promise<CoreConfig>;
	static async load(skipDb?: false): Promise<CoreSettings>;
	static async load(
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
