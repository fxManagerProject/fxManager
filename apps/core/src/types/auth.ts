export interface OAuthUser {
	id: string;
	username: string;
	email?: string;
	avatarUrl?: string;
}

export interface IOAuthProvider {
	readonly name: string;
	isConfigured(): boolean;
	initialize?(): Promise<void> | void;
	getAuthUrl(state: string, redirectUri: string): string;
	handleCallback(code: string, redirectUri: string): Promise<OAuthUser>;
}
