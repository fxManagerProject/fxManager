export type PlatformOS = 'windows' | 'linux' | 'unknown';

export interface CoreConfig {
	platform: PlatformOS;
	webServerPort: number;
	resourceApiToken: string;
	cookieSecret: string;
}
