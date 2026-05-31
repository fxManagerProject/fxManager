import { eq, and, gt } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { adminUsers, sessions } from '../schema';
import type * as schema from '../schema';
import { UserPermissions } from '@fxmanager/shared/constants';

type DB = BunSQLiteDatabase<typeof schema>;

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

class AuthRepository {
	private static instance: AuthRepository;

	private constructor(private readonly db: DB) {}

	static getInstance(db: DB): AuthRepository {
		if (!AuthRepository.instance) {
			AuthRepository.instance = new AuthRepository(db);
		}

		return AuthRepository.instance;
	}

	async createUser(
		username: string,
		password: string,
		permissions: number = 0,
		updateLoggedIn: boolean = false,
	) {
		const passwordHash = await Bun.password.hash(password, {
			algorithm: 'bcrypt',
		});

		// failsafe check, only allow master permission if no users are created
		const sanitizedPerms =
			this.countUsers() === 0
				? permissions
				: permissions & ~UserPermissions.MASTER;

		return this.db
			.insert(adminUsers)
			.values({
				username,
				passwordHash,
				createdAt: new Date(),
				lastLoginAt: updateLoggedIn ? new Date() : null,
				permissions: sanitizedPerms,
			})
			.returning()
			.get();
	}

	async deleteUser(adminId: number) {
		return await this.db.transaction(async (tx) => {
			const admin = await tx.query.adminUsers.findFirst({
				columns: { permissions: true },
				where: eq(adminUsers.id, adminId),
			});

			if (!admin) {
				throw new Error('not_found');
			}

			const isMaster = (admin.permissions & UserPermissions.MASTER) !== 0;
			if (isMaster) {
				throw new Error('admin_is_master');
			}

			const [deletedUser] = await tx
				.delete(adminUsers)
				.where(eq(adminUsers.id, adminId))
				.returning();

			return deletedUser;
		});
	}

	findUserByUsername(username: string) {
		return this.db
			.select()
			.from(adminUsers)
			.where(eq(adminUsers.username, username))
			.get();
	}

	countUsers(): number {
		return this.db.select({ id: adminUsers.id }).from(adminUsers).all().length;
	}

	async verifyPassword(username: string, password: string) {
		const user = this.db
			.select()
			.from(adminUsers)
			.where(eq(adminUsers.username, username))
			.get();

		if (!user) return null;

		const valid = await Bun.password.verify(password, user.passwordHash);

		if (!valid) return null;

		this.db
			.update(adminUsers)
			.set({ lastLoginAt: new Date() })
			.where(eq(adminUsers.id, user.id))
			.run();

		return user;
	}

	createSession(adminId: number) {
		const id = crypto.randomUUID();
		const now = new Date();
		const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
		return this.db
			.insert(sessions)
			.values({ id, adminId, createdAt: now, expiresAt })
			.returning()
			.get();
	}

	validateSession(sessionId: string) {
		const now = new Date();
		return this.db
			.select({ session: sessions, user: adminUsers })
			.from(sessions)
			.innerJoin(adminUsers, eq(sessions.adminId, adminUsers.id))
			.where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
			.get();
	}

	deleteSession(sessionId: string) {
		return this.db.delete(sessions).where(eq(sessions.id, sessionId)).run();
	}
}

export function createAuthRepository(db: DB) {
	return AuthRepository.getInstance(db);
}
