import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockGetMultipleSettings = mock();

mock.module('@fxmanager/database', () => ({
	repo: {
		settings: {
			getMultiple: mockGetMultipleSettings,
		},
	},
}));

const { DiscordOAuthProvider } = await import('./discord');

describe('DiscordOAuthProvider', () => {
	let provider: InstanceType<typeof DiscordOAuthProvider>;

	beforeEach(() => {
		mockGetMultipleSettings.mockClear();
		mockGetMultipleSettings.mockImplementation(() => ({
			'oauth.discordClientId': 'mock_client_id_123',
			'oauth.discordSecret': 'mock_client_secret_xyz',
			'oauth.discordEnabled': 'true',
		}));

		provider = new DiscordOAuthProvider();
	});

	describe('initialize & isConfigured', () => {
		it('should load configuration settings from the database repository', () => {
			expect(mockGetMultipleSettings).toHaveBeenCalledWith([
				'oauth.discordClientId',
				'oauth.discordSecret',
				'oauth.discordEnabled',
			]);
			expect(provider.isConfigured()).toBe(true);
		});

		it('should return false for isConfigured when clientId or clientSecret are missing', () => {
			mockGetMultipleSettings.mockImplementation(() => ({
				'oauth.discordClientId': undefined,
				'oauth.discordSecret': 'mock_client_secret_xyz',
				'oauth.discordEnabled': 'true',
			}));

			const unconfigured = new DiscordOAuthProvider();
			expect(unconfigured.isConfigured()).toBe(false);
		});
	});

	describe('getAuthUrl', () => {
		it('should construct a valid Discord authorization URL with query parameters', () => {
			const state = 'csrf_state_token';
			const redirectUri =
				'http://localhost:3000/api/auth/oauth/discord/callback';

			const urlStr = provider.getAuthUrl(state, redirectUri);
			const url = new URL(urlStr);

			expect(url.origin + url.pathname).toBe(
				'https://discord.com/oauth2/authorize',
			);
			expect(url.searchParams.get('client_id')).toBe('mock_client_id_123');
			expect(url.searchParams.get('redirect_uri')).toBe(redirectUri);
			expect(url.searchParams.get('response_type')).toBe('code');
			expect(url.searchParams.get('scope')).toBe('identify email');
			expect(url.searchParams.get('state')).toBe(state);
		});

		it('should throw an error if OAuth is disabled', () => {
			mockGetMultipleSettings.mockImplementation(() => ({
				'oauth.discordClientId': 'mock_client_id_123',
				'oauth.discordSecret': 'mock_client_secret_xyz',
				'oauth.discordEnabled': 'false',
			}));

			const disabledProvider = new DiscordOAuthProvider();
			expect(() =>
				disabledProvider.getAuthUrl('state', 'http://localhost/callback'),
			).toThrow('Discord OAuth is not enabled.');
		});

		it('should throw an error if OAuth credentials are missing', () => {
			mockGetMultipleSettings.mockImplementation(() => ({
				'oauth.discordClientId': undefined,
				'oauth.discordSecret': undefined,
				'oauth.discordEnabled': 'true',
			}));

			const unconfiguredProvider = new DiscordOAuthProvider();
			expect(() =>
				unconfiguredProvider.getAuthUrl('state', 'http://localhost/callback'),
			).toThrow('Discord OAuth is not configured on the server.');
		});
	});

	describe('handleCallback', () => {
		const redirectUri = 'http://localhost:3000/callback';
		const code = 'valid_oauth_code';

		it('should throw an error if OAuth is disabled', async () => {
			mockGetMultipleSettings.mockImplementation(() => ({
				'oauth.discordEnabled': 'false',
			}));

			const disabledProvider = new DiscordOAuthProvider();
			expect(
				disabledProvider.handleCallback(code, redirectUri),
			).rejects.toThrow('Discord OAuth is not enabled.');
		});

		it('should throw an error when token exchange endpoint returns an error response', async () => {
			globalThis.fetch = mock(() =>
				Promise.resolve(
					new Response('Invalid Authorization Code', {
						status: 400,
						statusText: 'Bad Request',
					}),
				),
			) as unknown as typeof fetch;

			expect(provider.handleCallback(code, redirectUri)).rejects.toThrow(
				'Failed to exchange authorization code: Invalid Authorization Code',
			);
		});

		it('should throw an error when user profile retrieval fails', async () => {
			const mockFetch = mock()
				// Token exchange succeeds
				.mockImplementationOnce(() =>
					Promise.resolve(
						new Response(JSON.stringify({ access_token: 'mock_token_123' }), {
							status: 200,
						}),
					),
				)
				// User profile lookup fails
				.mockImplementationOnce(() =>
					Promise.resolve(new Response('Unauthorized', { status: 401 })),
				);

			globalThis.fetch = mockFetch as unknown as typeof fetch;

			expect(provider.handleCallback(code, redirectUri)).rejects.toThrow(
				'Failed to retrieve user profile from Discord.',
			);
		});

		it('should complete OAuth exchange and map the profile to OAuthUser format', async () => {
			const mockFetch = mock()
				.mockImplementationOnce(() =>
					Promise.resolve(
						new Response(
							JSON.stringify({ access_token: 'mock_access_token' }),
							{ status: 200 },
						),
					),
				)
				.mockImplementationOnce(() =>
					Promise.resolve(
						new Response(
							JSON.stringify({
								id: '123456789012345678',
								username: 'discord_user',
								global_name: 'Display Name',
								email: 'user@example.com',
								avatar: 'a_1234567890',
							}),
							{ status: 200 },
						),
					),
				);

			globalThis.fetch = mockFetch as unknown as typeof fetch;

			const user = await provider.handleCallback(code, redirectUri);

			expect(user).toEqual({
				id: '123456789012345678',
				username: 'Display Name',
				email: 'user@example.com',
				avatarUrl:
					'https://cdn.discordapp.com/avatars/123456789012345678/a_1234567890.png',
			});
		});

		it('should fallback to username when global_name is missing and handle null avatar', async () => {
			const mockFetch = mock()
				.mockImplementationOnce(() =>
					Promise.resolve(
						new Response(
							JSON.stringify({ access_token: 'mock_access_token' }),
							{ status: 200 },
						),
					),
				)
				.mockImplementationOnce(() =>
					Promise.resolve(
						new Response(
							JSON.stringify({
								id: '999888777',
								username: 'legacy_username',
								avatar: null,
							}),
							{ status: 200 },
						),
					),
				);

			globalThis.fetch = mockFetch as unknown as typeof fetch;

			const user = await provider.handleCallback(code, redirectUri);

			expect(user.username).toBe('legacy_username');
			expect(user.avatarUrl).toBeUndefined();
		});
	});
});
