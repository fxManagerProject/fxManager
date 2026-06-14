/** biome-ignore-all lint/suspicious/noExplicitAny: explicit any allows clearing private singletons and verifying dynamic types */
import { afterAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../schema';
import { adminUsers, auditLog, players } from '../schema';
import { migrations, runMigrations } from '../migrations';
import { createAuditRepository } from './audit';

describe('AuditRepository', () => {
	const logSpy = spyOn(console, 'log').mockImplementation(() => {});

	let testSqlite: Database;
	let testDb: ReturnType<typeof drizzle<typeof schema>>;
	let auditRepo: ReturnType<typeof createAuditRepository>;

	beforeEach(() => {
		logSpy.mockClear();

		// Reset the internal singleton instance to clear previous execution contexts
		const zeroState = createAuditRepository({} as any);
		(zeroState.constructor as any).instance = undefined;

		// Setup an isolated in-memory SQLite database pool
		testSqlite = new Database(':memory:');

		// Explicitly toggle foreign key constraint validations to match production environment definitions
		testSqlite.run('PRAGMA foreign_keys = ON;');
		runMigrations(testSqlite, migrations);

		testDb = drizzle(testSqlite, { schema });
		auditRepo = createAuditRepository(testDb);
	});

	afterAll(() => {
		logSpy.mockRestore();
	});

	describe('log()', () => {
		it('should successfully write an audit entry containing unstructured JSON metadata', () => {
			const logPayload = {
				action: 'settings.update' as const,
				metadata: {
					changedKeys: ['onesync', 'maxPlayers'],
					triggeredBy: 'panel_ui',
				},
			};

			const result = auditRepo.log(logPayload);

			expect(result).toBeDefined();
			expect(result.id).toBeTypeOf('number');
			expect(result.action).toBe('settings.update');
			expect(result.metadata).toEqual(logPayload.metadata);
			expect(result.createdAt).toBeInstanceOf(Date);
			expect(result.adminId).toBeNull();
			expect(result.playerId).toBeNull();
		});
	});

	describe('list()', () => {
		// Helper to seed foundational data to keep tests scannable
		const seedCoreRelations = () => {
			const [admin] = testDb
				.insert(adminUsers)
				.values({
					username: 'super_operator',
					passwordHash: 'hash',
					createdAt: new Date(),
				})
				.returning()
				.all();

			const [player] = testDb
				.insert(players)
				.values({
					name: 'John_Doe',
				})
				.returning()
				.all();

			return { adminId: admin.id, playerId: player.id };
		};

		it('should load dynamic relational records via leftJoin strings and sort by date descending', async () => {
			const { adminId, playerId } = seedCoreRelations();

			testDb
				.insert(auditLog)
				.values([
					{
						action: 'server.start',
						adminId,
						createdAt: new Date('2026-06-14T10:00:00Z'),
					},
					{
						action: 'player.kick',
						adminId,
						playerId,
						metadata: { reason: 'RDM' },
						createdAt: new Date('2026-06-14T11:00:00Z'), // Newer entry
					},
				])
				.run();

			const response = await auditRepo.list(1, 10);

			expect(response.total).toBe(2);
			expect(response.items.length).toBe(2);

			// Verify strict descending chronological order (newest entry listed first)
			expect(response.items[0].action).toBe('player.kick');
			expect(response.items[0].admin).toBe('super_operator');
			expect(response.items[0].player).toBe('John_Doe');
			expect(response.items[0].metadata).toEqual({ reason: 'RDM' });

			expect(response.items[1].action).toBe('server.start');
		});

		it('should accurately isolate list records based on singular or multiple Action types', async () => {
			const { adminId } = seedCoreRelations();

			testDb
				.insert(auditLog)
				.values([
					{ action: 'server.start', adminId, createdAt: new Date() },
					{ action: 'server.stop', adminId, createdAt: new Date() },
					{ action: 'player.warn', adminId, createdAt: new Date() },
				])
				.run();

			// Match a singular string query
			const singularResult = await auditRepo.list(1, 10, 'player.warn');
			expect(singularResult.total).toBe(1);
			expect(singularResult.items[0].action).toBe('player.warn');

			// Match an array query condition
			const arrayResult = await auditRepo.list(1, 10, [
				'server.start',
				'server.stop',
			]);
			expect(arrayResult.total).toBe(2);
		});

		it('should search across player fields using fuzzy substring matches', async () => {
			const [playerTarget] = testDb
				.insert(players)
				.values({ name: 'Dangerous_Gamer' })
				.returning()
				.all();
			const [playerOther] = testDb
				.insert(players)
				.values({ name: 'Safe_User' })
				.returning()
				.all();

			testDb
				.insert(auditLog)
				.values([
					{
						action: 'player.ban',
						playerId: playerTarget.id,
						createdAt: new Date(),
					},
					{
						action: 'player.warn',
						playerId: playerOther.id,
						createdAt: new Date(),
					},
				])
				.run();

			const response = await auditRepo.list(1, 10, undefined, 'Dangerous');

			expect(response.total).toBe(1);
			expect(response.items[0].player).toBe('Dangerous_Gamer');
			expect(response.items[0].action).toBe('player.ban');
		});

		it('should slice query records precisely according to target Admin identifier sets', async () => {
			const { adminId: allowedAdmin } = seedCoreRelations();

			// otherAdmin is the full row object here
			const [otherAdmin] = testDb
				.insert(adminUsers)
				.values({
					username: 'stealth_mod',
					passwordHash: 'h',
					createdAt: new Date(),
				})
				.returning()
				.all();

			testDb
				.insert(auditLog)
				.values([
					{
						action: 'settings.update',
						adminId: allowedAdmin,
						createdAt: new Date(),
					},
					{
						action: 'whitelist.add',
						adminId: otherAdmin.id,
						createdAt: new Date(),
					},
				])
				.run();

			const response = await auditRepo.list(1, 10, undefined, undefined, [
				allowedAdmin,
			]);

			expect(response.total).toBe(1);
			expect(response.items[0].admin).toBe('super_operator');
			expect(response.items[0].action).toBe('settings.update');
		});

		it('should bind query constraints between explicit chronological date boundaries', async () => {
			const { adminId } = seedCoreRelations();

			testDb
				.insert(auditLog)
				.values([
					{
						action: 'server.start',
						adminId,
						createdAt: new Date('2026-06-01T00:00:00Z'),
					}, // Past
					{
						action: 'server.restart',
						adminId,
						createdAt: new Date('2026-06-10T00:00:00Z'),
					}, // Inside Target Window
					{
						action: 'server.stop',
						adminId,
						createdAt: new Date('2026-06-20T00:00:00Z'),
					}, // Future
				])
				.run();

			const dateFrom = new Date('2026-06-05T00:00:00Z');
			const dateTo = new Date('2026-06-15T00:00:00Z');

			const response = await auditRepo.list(
				1,
				10,
				undefined,
				undefined,
				undefined,
				dateFrom,
				dateTo,
			);

			expect(response.total).toBe(1);
			expect(response.items[0].action).toBe('server.restart');
		});

		it('should return empty values and a total of zero if constraints yield no rows', async () => {
			const response = await auditRepo.list(1, 50, 'report.close');

			expect(response.items).toEqual([]);
			expect(response.total).toBe(0);
		});
	});
});
