export type PlatformOS = 'windows' | 'linux' | 'unknown';

export interface CoreConfig {
	platform: PlatformOS;
	webServerPort: number;
	resourceApiToken: string;
	cookieSecret: string;
}

export interface ServerConfig {
	onesync: 'on' | 'legacy' | 'off';
	executablePath: string;
	serverDataPath: string;
	serverConfigFile: string;
}
