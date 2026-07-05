/** biome-ignore-all lint/suspicious/noExplicitAny: explicit any allows testing hidden state properties & mocking frames */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from 'bun:test';
import { wsManager } from '../ws/manager';
import { discordManager } from '../discord/manager';
import { ConfigManager } from '../config/manager';

const mockCheckBanned = mock(() => null as any);
const mockGetSetting = mock(() => 'none');
const mockFindByLicense = mock(() => null as any);
const mockIsStaff = mock(() => false);
const mockIsAnyIdentifierWhitelisted = mock(async () => false);
const mockUpsertPlayer = mock(async () => ({}));
const mockUpdatePlaytime = mock(async () => {});

// Stateful in-memory fake for the player_sessions repo so the join/drop wiring
// can be asserted through real open/close/listSessions behaviour.
let sessionRows: any[] = [];
let nextSessionId = 1;
const mockPlayerSessions = {
	open: mock(
		(
			playerId: number,
			serverSessionId: number | null,
			connectedAt: Date = new Date(),
		) => {
			const row = {
				id: nextSessionId++,
				playerId,
				serverSessionId,
				connectedAt: connectedAt.getTime(),
				disconnectedAt: null as number | null,
				durationMs: null as number | null,
				endReason: null as string | null,
			};
			sessionRows.push(row);
			return row;
		},
	),
	close: mock(
		(
			playerId: number,
			endReason: string | null = null,
			disconnectedAt: Date = new Date(),
		) => {
			const open = [...sessionRows]
				.reverse()
				.find((r) => r.playerId === playerId && r.disconnectedAt === null);
			if (!open) return null;
			open.disconnectedAt = disconnectedAt.getTime();
			open.durationMs = Math.max(0, open.disconnectedAt - open.connectedAt);
			open.endReason = endReason;
			return open;
		},
	),
	closeDangling: mock(() => {}),
	listSessions: (playerId: number, page = 1, pageSize = 25) => {
		const all = sessionRows
			.filter((r) => r.playerId === playerId)
			.sort((a, b) => b.connectedAt - a.connectedAt);
		return {
			items: all.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize),
			total: all.length,
			page,
			pageSize,
		};
	},
};

mock.module('@fxmanager/database', () => ({
	repo: {
		players: {
			checkBanned: mockCheckBanned,
			findByLicense: mockFindByLicense,
			isStaff: mockIsStaff,
			upsert: mockUpsertPlayer,
			updatePlaytime: mockUpdatePlaytime,
		},
		settings: { get: mockGetSetting },
		whitelist: { isAnyIdentifierWhitelisted: mockIsAnyIdentifierWhitelisted },
		disconnects: {
			recordEvent: () => {},
		},
		serverSessions: {
			open: () => ({ id: 1, startedAt: 0, endedAt: null, closeReason: null }),
			close: () => null,
			closeDangling: () => {},
			prune: () => {},
		},
		playerSessions: mockPlayerSessions,
	},
}));

mock.module('../../common/fxserver-endpoint', () => ({
	getServerNetEndpoint: async () => '127.0.0.1:30120',
}));

const GameManagerModule = await import('./manager');
import { sessionManager } from '../session/manager';
import type { PlayerIdentifiers } from '@fxmanager/shared/types';

type GameManagerInstance = InstanceType<typeof GameManagerModule.GameManager>;
describe('GameManager', () => {
	const originalFetch = global.fetch;
	let gameManager: GameManagerInstance;

	// Local Spy references for internal singletons
	let wsSpy: any;
	let discordIsConnectedSpy: any;
	let discordConnectSpy: any;
	let discordCheckWhitelistSpy: any;
	let configSpy: any;
	let setPlayerCountSpy: any;

	const sampleIdentifiers: PlayerIdentifiers = {
		license: 'license:11112222',
		discord: 'discord:33334444',
	};

	beforeEach(() => {
		// Reset database mock chains
		mockCheckBanned.mockReset().mockReturnValue(null);
		mockGetSetting.mockReset().mockReturnValue('none');
		mockFindByLicense.mockReset().mockReturnValue(null);
		mockIsStaff.mockReset().mockReturnValue(false);
		mockIsAnyIdentifierWhitelisted.mockReset().mockResolvedValue(false);
		mockUpsertPlayer.mockReset();
		mockUpdatePlaytime.mockReset();

		// Reset the stateful player_sessions fake
		sessionRows = [];
		nextSessionId = 1;
		mockPlayerSessions.open.mockClear();
		mockPlayerSessions.close.mockClear();
		mockPlayerSessions.closeDangling.mockClear();

		// Spying on core system managers cleanly isolates state mutations to this file execution context
		wsSpy = spyOn(wsManager, 'broadcast').mockImplementation(() => {});

		discordIsConnectedSpy = spyOn(
			discordManager,
			'isConnected',
		).mockReturnValue(false);
		discordConnectSpy = spyOn(discordManager, 'connect').mockResolvedValue(
			undefined,
		);
		discordCheckWhitelistSpy = spyOn(
			discordManager,
			'checkWhitelist',
		).mockResolvedValue(false);

		configSpy = spyOn(ConfigManager, 'getInstance').mockReturnValue({
			getSystemValues: () => ({ resourceApiToken: 'mock-token' }),
		} as any);

		setPlayerCountSpy = spyOn(
			sessionManager,
			'setPlayerCount',
		).mockImplementation(() => {});

		gameManager = new GameManagerModule.GameManager();
	});

	afterEach(() => {
		global.fetch = originalFetch;

		// Completely restore manager prototypes between test executions
		wsSpy.mockRestore();
		discordIsConnectedSpy.mockRestore();
		discordConnectSpy.mockRestore();
		discordCheckWhitelistSpy.mockRestore();
		configSpy.mockRestore();
		setPlayerCountSpy.mockRestore();
	});

	describe('Player Handling Basics', () => {
		it('should start with an empty internal tracking playerlist array', () => {
			expect(gameManager.getPlayerList()).toEqual([]);
			expect(gameManager.getPlayer(1)).toBeUndefined();
		});
	});

	describe('playerDeferralChecks()', () => {
		it('should block connection immediately if the player has an active permanent ban', async () => {
			const banDate = new Date('2026-06-01T12:00:00Z');
			mockCheckBanned.mockReturnValueOnce({
				reason: 'Cheating/Exploiting',
				createdAt: banDate,
				expiresAt: null,
			});

			const response =
				await gameManager.playerDeferralChecks(sampleIdentifiers);

			expect(mockCheckBanned).toHaveBeenCalledWith(sampleIdentifiers);
			expect(response).toEqual({
				access: false,
				type: 'ban',
				ban: {
					permanent: true,
					reason: 'Cheating/Exploiting',
					createdAt: banDate,
				},
			});
		});

		it('should calculate temporary ban boundaries cleanly if an expiration timestamp is provided', async () => {
			const banDate = new Date('2026-06-01T12:00:00Z');
			const expireDate = new Date('2026-07-01T12:00:00Z');
			mockCheckBanned.mockReturnValueOnce({
				reason: 'Toxic behavior',
				createdAt: banDate,
				expiresAt: expireDate,
			});

			const response =
				await gameManager.playerDeferralChecks(sampleIdentifiers);

			expect(response).toEqual({
				access: false,
				type: 'ban',
				ban: {
					permanent: false,
					reason: 'Toxic behavior',
					createdAt: banDate,
					expiresAt: expireDate,
				},
			});
		});

		it('should allow complete access if whitelist mode configuration is explicitly set to "none"', async () => {
			mockGetSetting.mockReturnValueOnce('none');

			const response =
				await gameManager.playerDeferralChecks(sampleIdentifiers);
			expect(response).toEqual({ access: true });
		});

		it('should bypass any whitelist restriction paths if the target license matches a recognized staff user profile', async () => {
			mockGetSetting.mockReturnValueOnce('admin-only');
			mockFindByLicense.mockReturnValueOnce({ id: 1337 });
			mockIsStaff.mockReturnValueOnce(true);

			const response =
				await gameManager.playerDeferralChecks(sampleIdentifiers);
			expect(mockFindByLicense).toHaveBeenCalledWith(sampleIdentifiers.license);
			expect(mockIsStaff).toHaveBeenCalledWith(1337);
			expect(response).toEqual({ access: true });
		});

		it('should decline connection access parameters if mode is "admin-only" and user is non-staff', async () => {
			mockGetSetting.mockReturnValueOnce('admin-only');
			mockFindByLicense.mockReturnValueOnce({ id: 55 });
			mockIsStaff.mockReturnValueOnce(false);

			const response =
				await gameManager.playerDeferralChecks(sampleIdentifiers);
			expect(response).toEqual({
				access: false,
				type: 'error',
				reason:
					'Server is in Administer Mode, you can not connect at this time.',
			});
		});

		describe('Whitelist Mode: identifier', () => {
			beforeEach(() => {
				mockGetSetting.mockReturnValue('identifier');
			});

			it('should permit entry if raw identifier repository lookup returns successfully', async () => {
				mockIsAnyIdentifierWhitelisted.mockResolvedValueOnce(true);

				const response =
					await gameManager.playerDeferralChecks(sampleIdentifiers);
				expect(mockIsAnyIdentifierWhitelisted).toHaveBeenCalledWith(
					sampleIdentifiers,
				);
				expect(response).toEqual({ access: true });
			});

			it('should reject non-whitelisted database identities cleanly', async () => {
				mockIsAnyIdentifierWhitelisted.mockResolvedValueOnce(false);

				const response =
					await gameManager.playerDeferralChecks(sampleIdentifiers);
				expect(response).toEqual({
					access: false,
					type: 'error',
					reason: 'You are not whitelisted.',
				});
			});
		});

		describe('Whitelist Mode: discord', () => {
			beforeEach(() => {
				mockGetSetting.mockReturnValue('discord');
			});

			it('should trigger connection loop on discordManager if called while state tracking shows disconnected', async () => {
				discordIsConnectedSpy.mockReturnValueOnce(false);
				discordCheckWhitelistSpy.mockResolvedValueOnce(true);

				const response =
					await gameManager.playerDeferralChecks(sampleIdentifiers);
				expect(discordConnectSpy).toHaveBeenCalled();
				expect(response).toEqual({ access: true });
			});

			it('should return error response safely if connection setup attempts on discord service fail', async () => {
				discordIsConnectedSpy.mockReturnValueOnce(false);
				discordConnectSpy.mockRejectedValueOnce(
					new Error('Discord Gateway unavailable'),
				);

				const response =
					await gameManager.playerDeferralChecks(sampleIdentifiers);
				expect(response).toEqual({
					access: false,
					type: 'error',
					reason:
						'Unable to check whitelist status, please contact server administrators',
				});
			});

			it('should instantly refuse access validation if player mapping metadata does not contain a discord footprint', async () => {
				discordIsConnectedSpy.mockReturnValueOnce(true);
				const missingDiscordPayload = { license: 'license:only_here' };

				const response = await gameManager.playerDeferralChecks(
					missingDiscordPayload,
				);
				expect(response).toEqual({
					access: false,
					type: 'error',
					reason: 'No discord identifier found.',
				});
			});

			it('should grant authorization payload clearances if role matching verification yields true', async () => {
				discordIsConnectedSpy.mockReturnValueOnce(true);
				discordCheckWhitelistSpy.mockResolvedValueOnce(true);

				const response =
					await gameManager.playerDeferralChecks(sampleIdentifiers);
				expect(discordCheckWhitelistSpy).toHaveBeenCalledWith(
					sampleIdentifiers.discord,
				);
				expect(response).toEqual({ access: true });
			});

			it('should refuse access gracefully with dedicated reason if validation roles are missing', async () => {
				discordIsConnectedSpy.mockReturnValueOnce(true);
				discordCheckWhitelistSpy.mockResolvedValueOnce(false);

				const response =
					await gameManager.playerDeferralChecks(sampleIdentifiers);
				expect(response).toEqual({
					access: false,
					type: 'error',
					reason:
						'You are not whitelisted, please address yourself to server staff.',
				});
			});
		});

		it('should throw safe fallback response warnings if system state hits an unhandled fallback setting mode', async () => {
			mockGetSetting.mockReturnValueOnce('invalid-corrupted-mode' as any);

			const response =
				await gameManager.playerDeferralChecks(sampleIdentifiers);
			expect(response).toEqual({
				access: false,
				type: 'error',
				reason: 'Server whitelist mode is not set, please inform server owner.',
			});
		});
	});

	describe('playerJoin()', () => {
		it('should perform upsert operations to active db records and broadcast state changes across tracking socket channels', async () => {
			const fakeDate = new Date('2026-06-13T00:00:00Z');
			const dbPlayerPayload = {
				id: 12,
				name: 'Vader',
				playtime: 4500,
				identifiers: sampleIdentifiers,
				isStaff: false,
				firstSeen: fakeDate,
				lastSeen: fakeDate,
			};
			mockUpsertPlayer.mockResolvedValueOnce(dbPlayerPayload);

			await gameManager.playerJoin({
				name: 'Vader',
				identifiers: sampleIdentifiers,
				serverId: 4,
			});

			const list = gameManager.getPlayerList();
			expect(list).toHaveLength(1);

			const expectedPayload = {
				serverId: 4,
				health: -1,
				...dbPlayerPayload,
			};
			expect(list[0]).toEqual(expectedPayload);
			expect(gameManager.getPlayer(12)).toEqual(expectedPayload);

			expect(wsSpy).toHaveBeenCalledWith({
				channel: 'playerlist',
				event: 'player_joined',
				data: expectedPayload,
			});
			expect(setPlayerCountSpy).toHaveBeenCalledWith(1);
		});

		it('should replace an existing entry with the same serverId on rejoin instead of duplicating it', async () => {
			const dbPlayerPayload = {
				id: 12,
				name: 'Vader',
				playtime: 4500,
				identifiers: sampleIdentifiers,
				isStaff: false,
				firstSeen: new Date(),
				lastSeen: new Date(),
			};
			mockUpsertPlayer.mockResolvedValue(dbPlayerPayload);

			await gameManager.playerJoin({
				name: 'Vader',
				identifiers: sampleIdentifiers,
				serverId: 4,
			});
			await gameManager.playerJoin({
				name: 'Vader',
				identifiers: sampleIdentifiers,
				serverId: 4,
			});

			expect(gameManager.getPlayerList()).toHaveLength(1);
			expect(setPlayerCountSpy).toHaveBeenLastCalledWith(1);
		});

		it('opens an in-progress player_session on join', async () => {
			const dbPlayerPayload = {
				id: 77,
				name: 'Rex',
				playtime: 0,
				identifiers: sampleIdentifiers,
				isStaff: false,
				firstSeen: new Date(),
				lastSeen: new Date(),
			};
			mockUpsertPlayer.mockResolvedValueOnce(dbPlayerPayload);

			await gameManager.playerJoin({
				name: 'Rex',
				identifiers: sampleIdentifiers,
				serverId: 3,
			});

			expect(mockPlayerSessions.open).toHaveBeenCalledWith(77, null);
			const { items } = mockPlayerSessions.listSessions(77, 1, 10);
			expect(items).toHaveLength(1);
			expect(items[0].disconnectedAt).toBeNull();
			expect(items[0].durationMs).toBeNull();
		});
	});

	describe('resetPlayerlist()', () => {
		it('should clear tracked players and push a zero player count', () => {
			(gameManager as any).playerlist.push({ serverId: 1 }, { serverId: 2 });

			gameManager.resetPlayerlist();

			expect(gameManager.getPlayerList()).toEqual([]);
			expect(setPlayerCountSpy).toHaveBeenCalledWith(0);
		});
	});

	describe('playerDrop()', () => {
		it('should seamlessly calculate session duration properties and flush tracking items on drop actions', async () => {
			const fakeStartTime = Date.now() - 30_000; // 30 seconds ago
			const trackedOnlinePlayer = {
				serverId: 9,
				id: 12,
				name: 'Vader',
				playtime: 1000,
				identifiers: sampleIdentifiers,
				isStaff: false,
				firstSeen: new Date(),
				lastSeen: new Date(fakeStartTime),
				health: 100,
				ping: 25,
			};

			// Inject test player into private fields
			(gameManager as any).playerlist.push(trackedOnlinePlayer);

			await gameManager.playerDrop(9);

			expect(gameManager.getPlayerList()).toHaveLength(0);
			expect(mockUpdatePlaytime).toHaveBeenCalledWith(12, expect.any(Number));
			expect(setPlayerCountSpy).toHaveBeenCalledWith(0);
			expect(wsSpy).toHaveBeenCalledWith({
				channel: 'playerlist',
				event: 'player_left',
				data: { serverId: 9 },
			});
		});

		it('should log warning contexts and abandon execution trees safely if requested serverId track targets do not map up', async () => {
			await gameManager.playerDrop(999);
			expect(mockUpdatePlaytime).not.toHaveBeenCalled();
			expect(wsSpy).not.toHaveBeenCalled();
		});

		it('playerDrop forwards drop details of tracked players to the disconnect manager', async () => {
			const { disconnectManager } = await import('../disconnect/manager');
			const recordSpy = spyOn(
				disconnectManager,
				'recordDrop',
			).mockImplementation(() => {});
			(gameManager as any).playerlist.push({
				serverId: 42,
				id: 12,
				name: 'Vader',
				playtime: 1000,
				identifiers: sampleIdentifiers,
				isStaff: false,
				firstSeen: new Date(),
				lastSeen: new Date(),
				health: 100,
				ping: 25,
			});
			await gameManager.playerDrop(42, {
				reason: 'Exiting',
				resourceName: 'x',
				category: 2,
			});
			expect(recordSpy).toHaveBeenCalledWith({
				reason: 'Exiting',
				resourceName: 'x',
				category: 2,
			});
			recordSpy.mockRestore();
		});

		it('playerDrop does not record disconnect stats for untracked players', async () => {
			const { disconnectManager } = await import('../disconnect/manager');
			const recordSpy = spyOn(
				disconnectManager,
				'recordDrop',
			).mockImplementation(() => {});
			await gameManager.playerDrop(999, { reason: 'Exiting', category: 2 });
			expect(recordSpy).not.toHaveBeenCalled();
			recordSpy.mockRestore();
		});

		it('closes the open player_session with the drop reason', async () => {
			mockPlayerSessions.open(12, null, new Date(Date.now() - 5_000));
			(gameManager as any).playerlist.push({
				serverId: 9,
				id: 12,
				name: 'Vader',
				playtime: 1000,
				identifiers: sampleIdentifiers,
				isStaff: false,
				firstSeen: new Date(),
				lastSeen: new Date(Date.now() - 5_000),
				health: 100,
				ping: 25,
			});

			await gameManager.playerDrop(9, { reason: 'Quit', category: 0 });

			expect(mockPlayerSessions.close).toHaveBeenCalledWith(12, 'Quit');
			const { items } = mockPlayerSessions.listSessions(12, 1, 10);
			expect(items[0].disconnectedAt).not.toBeNull();
			expect(items[0].durationMs).toBeGreaterThanOrEqual(0);
			expect(items[0].endReason).toBe('Quit');
		});

		it('closes the player_session with a null reason when drop carries no reason', async () => {
			mockPlayerSessions.open(12, null, new Date(Date.now() - 5_000));
			(gameManager as any).playerlist.push({
				serverId: 9,
				id: 12,
				name: 'Vader',
				playtime: 1000,
				identifiers: sampleIdentifiers,
				isStaff: false,
				firstSeen: new Date(),
				lastSeen: new Date(Date.now() - 5_000),
				health: 100,
				ping: 25,
			});

			await gameManager.playerDrop(9);

			expect(mockPlayerSessions.close).toHaveBeenCalledWith(12, null);
		});
	});

	describe('playerUpdates()', () => {
		it('should cleanly parse parameter updates across dynamic payload dictionary tables', async () => {
			const player1 = { serverId: 1, health: 100, ping: 10 };
			const player2 = { serverId: 2, health: 100, ping: 20 };
			(gameManager as any).playerlist = [player1, player2];

			const updatePackage = {
				'1': [85, 12],
				'2': [40, 150],
			} as const;

			await gameManager.playerUpdates(updatePackage as any);

			expect(player1.health).toBe(85);
			expect(player1.ping).toBe(12);
			expect(player2.health).toBe(40);
			expect(player2.ping).toBe(150);

			expect(wsSpy).toHaveBeenCalledWith({
				channel: 'playerlist',
				event: 'player_update',
				data: updatePackage,
			});
		});
	});

	describe('dropPlayer()', () => {
		it('should dispatch valid post payloads out to routing gateways and decode success structures perfectly', async () => {
			global.fetch = mock(async () => {
				return {
					ok: true,
					json: async () => ({ success: true }),
				} as Response;
			}) as any;

			const response = await gameManager.dropPlayer(2, 'Exploiting Loop holes');

			expect(global.fetch).toHaveBeenCalledWith(
				'http://127.0.0.1:30120/fxManager/drop',
				{
					method: 'POST',
					body: JSON.stringify({
						serverId: 2,
						reason: 'Exploiting Loop holes',
					}),
					headers: {
						Application: 'json/application',
						'x-resource-token': 'mock-token',
					},
				},
			);
			expect(response).toEqual({ success: true, data: null });
		});

		it('should catch validation error flags gracefully if target router gates declare response failures', async () => {
			global.fetch = mock(async () => {
				return {
					ok: false,
					status: 403,
					statusText: 'Forbidden Token Footprint',
				} as Response;
			}) as any;

			const response = await gameManager.dropPlayer(2, 'Reason');
			expect(response).toEqual({
				success: false,
				error: 'Server responded with 403: Forbidden Token Footprint',
			});
		});

		it('should forward structural error data payloads cleanly if response execution properties explicitly fail success validations', async () => {
			global.fetch = mock(async () => {
				return {
					ok: true,
					json: async () => ({
						success: false,
						error: 'Target player missing',
					}),
				} as Response;
			}) as any;

			const response = await gameManager.dropPlayer(2, 'Reason');
			expect(response).toEqual({
				success: false,
				error: 'Target player missing',
			});
		});

		it('should absorb connection drop metrics processing faults safely through operational try/catch blocks', async () => {
			global.fetch = mock(async () => {
				throw new Error('Test Error');
			}) as any;

			const response = await gameManager.dropPlayer(2, 'Reason');
			expect(response).toEqual({
				success: false,
				error: 'Test Error',
			});
		});
	});
});
