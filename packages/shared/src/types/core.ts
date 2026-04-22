export type PlatformOS = 'windows' | 'linux' | 'unknown';

export interface CoreConfig {
	platform: PlatformOS;
	executable: string;
	serverDataPath: string;
	configFile: string;
	autoRestart: boolean;
	maxRestarts: number;
	restartDelayMs: number;
	webServerPort: number;
	resourceApiToken: string;
	cookieSecret: string;
}
