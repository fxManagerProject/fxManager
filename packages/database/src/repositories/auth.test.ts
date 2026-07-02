/** biome-ignore-all lint/suspicious/noExplicitAny: explicit any allows clearing private singletons and verifying dates */
import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import * as schema from '../schema';
import { sessions, adminUsers } from '../schema';
import { migrations, runMigrations } from '../migrations';
import { createAuthRepository } from './auth';
import { UserPermissions } from '@fxmanager/shared/constants';
import { spyOn } from 'bun:test';

describe('AuthRepository', () => {
	const logSpy = spyOn(console, 'log').mockImplementation(() => {});

	let testSqlite: Database;
	let testDb: ReturnType<typeof drizzle<typeof schema>>;
	let authRepo: ReturnType<typeof createAuthRepository>;

	beforeEach(() => {
		logSpy.mockClear();

		// Reset the internal singleton instance to clear previous execution contexts
		const zeroState = createAuthRepository({} as any);
		(zeroState.constructor as any).instance = undefined;

		// Setup isolated database pool and guarantee cascading foreign keys are enforced
		testSqlite = new Database(':memory:');
		testSqlite.run('PRAGMA foreign_keys = ON;');
		runMigrations(testSqlite, migrations);

		testDb = drizzle(testSqlite, { schema });
		authRepo = createAuthRepository(testDb);
	});

	afterAll(() => {
		logSpy.mockRestore();
	});

	describe('createUser()', () => {
		it('should correctly hash password strings and respect custom initial log flags', async () => {
			const user = await authRepo.createUser(
				'operator_one',
				'securePassword123',
				UserPermissions.KICK,
				true,
			);

			expect(user).toBeDefined();
			expect(user.username).toBe('operator_one');

			// Verify Bun's underlying cryptographic hashing successfully fired
			expect(user.passwordHash).not.toBe('securePassword123');
			const standardCheck = await Bun.password.verify(
				'securePassword123',
				user.passwordHash,
			);
			expect(standardCheck).toBe(true);

			expect(user.lastLoginAt).toBeInstanceOf(Date);
		});

		it('should grant MASTER privileges exclusively if the user is the first recorded system account', async () => {
			// First account creation event
			const rootUser = await authRepo.createUser(
				'root',
				'pass',
				UserPermissions.MASTER,
			);
			expect(rootUser.permissions & UserPermissions.MASTER).not.toBe(0);

			// Subsequent account creation event
			const standardUser = await authRepo.createUser(
				'sneaky_mod',
				'pass',
				UserPermissions.MASTER | UserPermissions.BAN,
			);

			// Verify bitwise operations stripped the MASTER flag safely
			expect(standardUser.permissions & UserPermissions.MASTER).toBe(0);
			expect(standardUser.permissions & UserPermissions.BAN).not.toBe(0);
		});

		it('should link the given player in the same insert', async () => {
			const player = testDb
				.insert(schema.players)
				.values({ name: 'LinkedInGame' })
				.returning()
				.get();

			const user = await authRepo.createUser(
				'linked_admin',
				'pass',
				UserPermissions.KICK,
				false,
				player.id,
			);

			expect(user.playerId).toBe(player.id);
		});

		it('should not create an orphan account when the linked player does not exist', async () => {
			expect(
				authRepo.createUser('ghost_link', 'pass', 0, false, 9999),
			).rejects.toThrow(/FOREIGN KEY/);

			expect(authRepo.findUserByUsername('ghost_link')).toBeUndefined();
		});
	});

	describe('deleteUser()', () => {
		it('should safely drop an administrator and cleanly cascade-delete associated active sessions', async () => {
			const user = await authRepo.createUser(
				'discard_admin',
				'p',
				UserPermissions.KICK,
			);
			const session = authRepo.createSession(user.id);

			const deleted = await authRepo.deleteUser(user.id);
			expect(deleted.id).toBe(user.id);

			// Verify cascading rules removed active sessions from the database
			const lookupSession = testDb
				.select()
				.from(sessions)
				.where(eq(sessions.id, session.id))
				.get();
			expect(lookupSession).toBeUndefined();
		});

		it('should throw an evaluation runtime exception if the target admin identifier does not exist', async () => {
			expect(authRepo.deleteUser(9999)).rejects.toThrow('not_found');
		});

		it('should enforce an absolute failsafe block protecting accounts marked with MASTER privileges', async () => {
			const rootUser = await authRepo.createUser(
				'root_admin',
				'p',
				UserPermissions.MASTER,
			);

			expect(authRepo.deleteUser(rootUser.id)).rejects.toThrow(
				'admin_is_master',
			);
		});
	});

	describe('verifyPassword()', () => {
		it('should authenticate correct passphrases and transparently refresh login timestamps', async () => {
			const createdUser = await authRepo.createUser(
				'auth_test',
				'secret_pass',
				UserPermissions.NONE,
			);

			const verifiedUser = await authRepo.verifyPassword(
				'auth_test',
				'secret_pass',
			);
			expect(verifiedUser).not.toBeNull();
			expect(verifiedUser?.username).toBe('auth_test');

			const dbCheck = testDb
				.select()
				.from(adminUsers)
				.where(eq(adminUsers.id, createdUser.id))
				.get();
			expect(dbCheck?.lastLoginAt).toBeInstanceOf(Date);
		});

		it('should reject verification updates and return null if structural parameters or passwords mismatch', async () => {
			await authRepo.createUser(
				'auth_test',
				'correct_pass',
				UserPermissions.NONE,
			);

			// Check bad password lookup
			const badPassResult = await authRepo.verifyPassword(
				'auth_test',
				'wrong_pass',
			);
			expect(badPassResult).toBeNull();

			// Check non-existent username lookup
			const badUserResult = await authRepo.verifyPassword(
				'ghost_user',
				'correct_pass',
			);
			expect(badUserResult).toBeNull();
		});
	});

	describe('Session Lifecycle Management', () => {
		it('should provisions unique sessions with strict 7-day TTL parameters', async () => {
			const user = await authRepo.createUser(
				'session_user',
				'p',
				UserPermissions.NONE,
			);

			const session = authRepo.createSession(user.id);

			expect(session).toBeDefined();
			expect(session.id).toBeTypeOf('string'); // UUID string format
			expect(session.adminId).toBe(user.id);

			// Assert precise 7-day delta timestamp window
			const deltaMs = session.expiresAt.getTime() - session.createdAt.getTime();
			const expectedTtl = 1000 * 60 * 60 * 24 * 7;
			expect(deltaMs).toBe(expectedTtl);
		});

		it('should accurately authorize current sessions and combine matching relational data objects', async () => {
			const user = await authRepo.createUser(
				'session_user',
				'p',
				UserPermissions.WARN,
			);
			const session = authRepo.createSession(user.id);

			const validated = authRepo.validateSession(session.id);

			expect(validated).toBeDefined();
			expect(validated?.session.id).toBe(session.id);
			expect(validated?.user.username).toBe('session_user');
			expect(validated?.user.permissions).toBe(UserPermissions.WARN);
		});

		it('should invalidate lookups if the target session ID has expired', async () => {
			const user = await authRepo.createUser(
				'expired_user',
				'p',
				UserPermissions.NONE,
			);

			// Inject an artificially expired session row directly into the database context
			const expiredId = crypto.randomUUID();
			testDb
				.insert(sessions)
				.values({
					id: expiredId,
					adminId: user.id,
					createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), // Created 10 days ago
					expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // Expired 3 days ago
				})
				.run();

			const validated = authRepo.validateSession(expiredId);
			expect(validated).toBeUndefined();
		});

		it('should drop active sessions from the database schema when deleteSession() is called', async () => {
			const user = await authRepo.createUser(
				'logout_user',
				'p',
				UserPermissions.NONE,
			);
			const session = authRepo.createSession(user.id);

			authRepo.deleteSession(session.id);

			// Confirm structural deletion
			const validated = authRepo.validateSession(session.id);
			expect(validated).toBeUndefined();
		});

		it('should resolve the assigned group and effective permissions', async () => {
			const group = testDb
				.insert(schema.adminGroups)
				.values({
					name: 'SessionMods',
					permissions: UserPermissions.KICK | UserPermissions.WARN,
					colour: '#fff',
					createdAt: new Date(),
				})
				.returning()
				.get();
			const user = await authRepo.createUser('grouped_user', 'p');
			testDb
				.update(adminUsers)
				.set({ groupId: group.id })
				.where(eq(adminUsers.id, user.id))
				.run();
			const session = authRepo.createSession(user.id);

			const validated = authRepo.validateSession(session.id);

			expect(validated?.group?.id).toBe(group.id);
			expect(validated?.effectivePermissions).toBe(
				UserPermissions.KICK | UserPermissions.WARN,
			);
		});

		it('should fall back to personal permissions for ungrouped admins', async () => {
			const user = await authRepo.createUser(
				'solo_user',
				'p',
				UserPermissions.BAN,
			);
			const session = authRepo.createSession(user.id);

			const validated = authRepo.validateSession(session.id);

			expect(validated?.group).toBeNull();
			expect(validated?.effectivePermissions).toBe(UserPermissions.BAN);
		});
	});
});
