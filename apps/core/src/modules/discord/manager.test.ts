/** biome-ignore-all lint/suspicious/noExplicitAny: explicit any allows testing hidden state properties & mocking frames */
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { Events } from 'discord.js';
import { mockDestroy, mockGuildsFetch, mockLogin } from './discord.mock';

const TEST_BOT_TOKEN = 'test-token';
const TEST_GUILD_ID = '1234567890';
const TEST_ROLE_IDS = ['role-admin', 'role-mod'];

const mockSettingsGet = mock((key: string): string | undefined => {
	if (key === 'whitelist.discordBotToken') return TEST_BOT_TOKEN;
	if (key === 'whitelist.discordGuildId') return TEST_GUILD_ID;
	if (key === 'whitelist.discordRoleIds') return TEST_ROLE_IDS.join(',');
	return undefined;
});

mock.module('@fxmanager/database', () => ({
	repo: {
		settings: { get: mockSettingsGet },
		players: {},
		whitelist: {},
	},
}));

import { discordManager } from './manager';

const mockMembersFetch = mock(async () => ({}));

// Helper to access internal components securely
const getPrivateClient = (manager: typeof discordManager): any =>
	(manager as any).client;

describe('DiscordManager', () => {
	const originalEnv = { ...process.env };
	const mockConfig = {
		token: TEST_BOT_TOKEN,
		guildId: TEST_GUILD_ID,
		whitelistedRoles: TEST_ROLE_IDS,
	};

	// Re-instantiate a clean class instance for every test block if isolation is needed
	beforeEach(() => {
		mockLogin.mockClear();
		mockDestroy.mockClear();
		mockGuildsFetch.mockClear();
		mockMembersFetch.mockClear();

		// Reset the properties directly on the exported singleton instance
		(discordManager as any).botToken = mockConfig.token;
		(discordManager as any).config = {
			guildId: mockConfig.guildId,
			whitelistedRoles: mockConfig.whitelistedRoles,
		};
		(discordManager as any).connectionState = false;
		(discordManager as any).guild = null;
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('Initialization & Basics', () => {
		it('should start in a disconnected state', () => {
			expect(discordManager.isConnected()).toBe(false);
		});
	});

	describe('connect()', () => {
		it('should connect, fetch guild and set state to connected successfully', async () => {
			const clientInstance = getPrivateClient(discordManager);
			const mockGuildPayload = { name: 'Test Guild', id: mockConfig.guildId };
			mockGuildsFetch.mockResolvedValue(mockGuildPayload);

			const connectPromise = discordManager.connect();

			// Trigger the event asynchronously to emulate a successful gateway hook
			setTimeout(() => {
				clientInstance.emit(Events.ClientReady, clientInstance);
			}, 0);

			await connectPromise;

			expect(mockLogin).toHaveBeenCalledWith(mockConfig.token);
			expect(mockGuildsFetch).toHaveBeenCalledWith(mockConfig.guildId);
			expect(discordManager.isConnected()).toBe(true);
		});

		it('should bubble up error and reset state to false when guild fetch throws', async () => {
			const clientInstance = getPrivateClient(discordManager);
			mockGuildsFetch.mockRejectedValue(new Error('Discord API Outage'));

			const connectPromise = discordManager.connect();

			setTimeout(() => {
				clientInstance.emit(Events.ClientReady, clientInstance);
			}, 0);

			expect(connectPromise).rejects.toThrow('Discord API Outage');
			expect(discordManager.isConnected()).toBe(false);
		});

		it('should break early if Client.login rejects', async () => {
			mockLogin.mockRejectedValue(new Error('Invalid Token provided'));

			expect(discordManager.connect()).rejects.toThrow(
				'Invalid Token provided',
			);
			expect(discordManager.isConnected()).toBe(false);
		});
	});

	describe('disconnect()', () => {
		it('should safely shut down client connection and change active state tracking', async () => {
			// Artificially toggle connected status up
			(discordManager as any).connectionState = true;

			await discordManager.disconnect();

			expect(mockDestroy).toHaveBeenCalled();
			expect(discordManager.isConnected()).toBe(false);
		});

		it('should keep processing if discord.js client destroy rejects under the hood', async () => {
			(discordManager as any).connectionState = true;
			mockDestroy.mockRejectedValue(new Error('Forcefully closed socket'));

			// Should not throw
			await discordManager.disconnect();
			expect(discordManager.isConnected()).toBe(false);
		});
	});

	describe('checkWhitelist()', () => {
		it('throws if called before a guild instance has been cached via connect()', async () => {
			expect(discordManager.checkWhitelist('456')).rejects.toThrow(
				`No guild was found for id: ${mockConfig.guildId}`,
			);
		});

		describe('With Loaded Guild Context', () => {
			const mockRolesCache = {
				hasAny: mock(() => false),
			};

			beforeEach(() => {
				(discordManager as any).guild = {
					members: {
						fetch: mockMembersFetch,
					},
				};
				mockRolesCache.hasAny.mockClear();
			});

			it('strips "discord:" prefix out of input identifiers cleanly', async () => {
				mockMembersFetch.mockResolvedValue({
					roles: { cache: mockRolesCache },
				});

				await discordManager.checkWhitelist('discord:987654321');

				expect(mockMembersFetch).toHaveBeenCalledWith('987654321');
			});

			it('queries raw IDs perfectly without string manipulation changes', async () => {
				mockMembersFetch.mockResolvedValue({
					roles: { cache: mockRolesCache },
				});

				await discordManager.checkWhitelist('987654321');

				expect(mockMembersFetch).toHaveBeenCalledWith('987654321');
			});

			it('returns true if the extracted member possesses targeted whitelisted roles', async () => {
				mockRolesCache.hasAny.mockReturnValue(true);
				mockMembersFetch.mockResolvedValue({
					roles: { cache: mockRolesCache },
				});

				const result = await discordManager.checkWhitelist('123');

				expect(mockRolesCache.hasAny).toHaveBeenCalledWith(
					...mockConfig.whitelistedRoles,
				);
				expect(result).toBe(true);
			});

			it('returns false if the extracted member does not hold matching values', async () => {
				mockRolesCache.hasAny.mockReturnValue(false);
				mockMembersFetch.mockResolvedValue({
					roles: { cache: mockRolesCache },
				});

				const result = await discordManager.checkWhitelist('123');

				expect(result).toBe(false);
			});

			it('gracefully intercept member fetch errors and returns false', async () => {
				mockMembersFetch.mockRejectedValue(new Error('404 Member Not Found'));

				const result = await discordManager.checkWhitelist('invalid-user-id');

				expect(result).toBe(false);
			});
		});
	});
});
