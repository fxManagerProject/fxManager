import { describe, expect, it, mock } from 'bun:test';
import type { IOAuthProvider } from '../../types';

// Mock database to prevent SQLite errors when DiscordOAuthProvider initializes at top-level
mock.module('@fxmanager/database', () => ({
	repo: {
		settings: {
			getMultiple: mock(() => ({
				'oauth.discordClientId': 'mock_client_id',
				'oauth.discordSecret': 'mock_client_secret',
				'oauth.discordEnabled': 'true',
			})),
		},
	},
}));

// Dynamically import manager after mocking the database module
const { OAuthManager, oauthManager } = await import('./manager');

describe('OAuthManager', () => {
	it('should register a provider and return `this` for chaining', () => {
		const manager = new OAuthManager();
		const mockProvider = { name: 'google' } as IOAuthProvider;

		const result = manager.registerProvider(mockProvider);

		expect(result).toBe(manager);
		expect(manager.hasProvider('google')).toBe(true);
	});

	it('should retrieve a registered provider', () => {
		const manager = new OAuthManager();
		const mockProvider = { name: 'github' } as IOAuthProvider;

		manager.registerProvider(mockProvider);

		const retrieved = manager.getProvider('github');
		expect(retrieved).toBe(mockProvider);
	});

	it('should throw an error when attempting to retrieve an unregistered provider', () => {
		const manager = new OAuthManager();

		expect(() => manager.getProvider('unregistered')).toThrow(
			"OAuth provider 'unregistered' is not registered.",
		);
	});

	it('should return false for hasProvider when provider is missing', () => {
		const manager = new OAuthManager();

		expect(manager.hasProvider('nonexistent')).toBe(false);
	});

	it('should reload providers with initialize() AND handle providers without initialize()', () => {
		const manager = new OAuthManager();
		const mockInit = mock();

		const providerWithInit = {
			name: 'with-init',
			initialize: mockInit,
		} as unknown as IOAuthProvider;

		const providerWithoutInit = {
			name: 'without-init',
		} as unknown as IOAuthProvider;

		manager.registerProvider(providerWithInit);
		manager.registerProvider(providerWithoutInit);

		const result = manager.reload();

		expect(result).toBe(manager);
		expect(mockInit).toHaveBeenCalledTimes(1);
	});

	describe('Exported oauthManager Singleton', () => {
		it('should export a default oauthManager instance pre-registered with Discord', () => {
			expect(oauthManager).toBeInstanceOf(OAuthManager);
			expect(oauthManager.hasProvider('discord')).toBe(true);
			expect(oauthManager.getProvider('discord').name).toBe('discord');
		});
	});
});
