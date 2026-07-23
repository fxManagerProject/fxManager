import { repo } from '@fxmanager/database';
import type { IOAuthProvider, OAuthUser } from '../../../types';

export class DiscordOAuthProvider implements IOAuthProvider {
	readonly name = 'discord';
	private enabled: boolean = false;
	private clientId?: string;
	private clientSecret?: string;
	private scopes: string[] = ['identify', 'email'];

	constructor() {
		this.initialize();
	}

	initialize() {
		try {
			const settings = repo.settings.getMultiple([
				'oauth.discordClientId',
				'oauth.discordSecret',
				'oauth.discordEnabled',
			]);

			this.clientId = settings['oauth.discordClientId'];
			this.clientSecret = settings['oauth.discordSecret'];
			this.enabled = settings['oauth.discordEnabled'] == 'true' ? true : false;
		} catch {}
	}

	isConfigured(): boolean {
		return (
			typeof this.clientId === 'string' && typeof this.clientSecret === 'string'
		);
	}

	getAuthUrl(state: string, redirectUri: string): string {
		if (!this.enabled) {
			throw new Error('Discord OAuth is not enabled.');
		}
		if (!this.isConfigured()) {
			throw new Error('Discord OAuth is not configured on the server.');
		}

		const params = new URLSearchParams({
			// ! used because covered in this.isConfigured check
			client_id: this.clientId!,
			redirect_uri: redirectUri,
			response_type: 'code',
			scope: this.scopes.join(' '),
			state,
		});

		return `https://discord.com/oauth2/authorize?${params.toString()}`;
	}

	async handleCallback(code: string, redirectUri: string): Promise<OAuthUser> {
		if (!this.enabled) {
			throw new Error('Discord OAuth is not enabled.');
		}
		if (!this.isConfigured()) {
			throw new Error('Discord OAuth is not configured on the server.');
		}

		const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				// ! used because covered in this.isConfigured check
				client_id: this.clientId!,
				client_secret: this.clientSecret!,
				grant_type: 'authorization_code',
				code,
				redirect_uri: redirectUri,
			}),
		});

		if (!tokenResponse.ok) {
			const errorText = await tokenResponse.text();
			throw new Error(`Failed to exchange authorization code: ${errorText}`);
		}

		const tokenData = (await tokenResponse.json()) as { access_token: string };

		const userResponse = await fetch('https://discord.com/api/users/@me', {
			headers: {
				Authorization: `Bearer ${tokenData.access_token}`,
			},
		});

		if (!userResponse.ok) {
			throw new Error('Failed to retrieve user profile from Discord.');
		}

		const userData = (await userResponse.json()) as {
			id: string;
			username: string;
			global_name?: string;
			email?: string;
			avatar?: string;
		};

		return {
			id: userData.id,
			username: userData.global_name || userData.username,
			email: userData.email,
			avatarUrl: userData.avatar
				? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
				: undefined,
		};
	}
}
