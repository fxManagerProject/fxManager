import { eq, isNull } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { apiTokens } from '../schema';
import type * as schema from '../schema';

type DB = BunSQLiteDatabase<typeof schema>;

export function createApiTokensRepository(db: DB) {
  return {
    create(name: string) {
      const token = `fp_${crypto.randomUUID().replace(/-/g, '')}`;
      return db.insert(apiTokens).values({ name, token, createdAt: new Date() }).returning().get();
    },

    validate(token: string) {
      const row = db.select().from(apiTokens).where(eq(apiTokens.token, token)).get();

      if (!row || row.revokedAt) return null;

      // Update lastUsed async — fire and forget
      db.update(apiTokens).set({ lastUsed: new Date() }).where(eq(apiTokens.id, row.id)).run();

      return row;
    },

    revoke(id: number) {
      return db
        .update(apiTokens)
        .set({ revokedAt: new Date() })
        .where(eq(apiTokens.id, id))
        .returning()
        .get();
    },

    list() {
      return db.select().from(apiTokens).where(isNull(apiTokens.revokedAt)).all();
    },
  };
}
