import { eq, and, gt } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { adminUsers, sessions } from '../schema';
import type * as schema from '../schema';

type DB = BunSQLiteDatabase<typeof schema>;

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function createAuthRepository(db: DB) {
	return {
		async createUser(
			username: string,
			password: string,
			permissions: number = 0,
			updateLoggedIn: boolean = false,
		) {
			const passwordHash = await Bun.password.hash(password, {
				algorithm: 'bcrypt',
			});
			return db
				.insert(adminUsers)
				.values({
					username,
					passwordHash,
					createdAt: new Date(),
					lastLoginAt: updateLoggedIn ? new Date() : null,
					permissions,
				})
				.returning()
				.get();
		},

		findUserByUsername(username: string) {
			return db
				.select()
				.from(adminUsers)
				.where(eq(adminUsers.username, username))
				.get();
		},

		countUsers(): number {
			return db.select({ id: adminUsers.id }).from(adminUsers).all().length;
		},

		async verifyPassword(username: string, password: string) {
			const user = db
				.select()
				.from(adminUsers)
				.where(eq(adminUsers.username, username))
				.get();
			if (!user) return null;
			const valid = await Bun.password.verify(password, user.passwordHash);
			if (!valid) return null;
			db.update(adminUsers)
				.set({ lastLoginAt: new Date() })
				.where(eq(adminUsers.id, user.id))
				.run();
			return user;
		},

		createSession(adminId: number) {
			const id = crypto.randomUUID();
			const now = new Date();
			const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
			return db
				.insert(sessions)
				.values({ id, adminId, createdAt: now, expiresAt })
				.returning()
				.get();
		},

		validateSession(sessionId: string) {
			const now = new Date();
			return db
				.select({ session: sessions, user: adminUsers })
				.from(sessions)
				.innerJoin(adminUsers, eq(sessions.adminId, adminUsers.id))
				.where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
				.get();
		},

		deleteSession(sessionId: string) {
			return db.delete(sessions).where(eq(sessions.id, sessionId)).run();
		},
	};
}
