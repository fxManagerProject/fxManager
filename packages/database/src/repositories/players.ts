import { eq, desc, and } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { players, playerIdentifiers } from '../schema';
import type * as schema from '../schema';
import { PlayerIdentifiers } from '@fxmanager/types';

type DB = BunSQLiteDatabase<typeof schema>;

export function createPlayersRepository(db: DB) {
  return {
    findByLicense(license: string) {
      return db
        .select({
          player: players,
        })
        .from(players)
        .innerJoin(playerIdentifiers, eq(playerIdentifiers.playerId, players.id))
        .where(and(eq(playerIdentifiers.type, 'license'), eq(playerIdentifiers.value, license)))
        .get();
    },

    /* ToDo:
     * Consideration, if a player has the same identifier as another drop ? Deny connection ?
     */

    async upsert(name: string, identifiers: PlayerIdentifiers) {
      const now = new Date();
      return db.transaction(async (tx) => {
        const existingIdentifier = tx
          .select()
          .from(playerIdentifiers)
          .where(
            and(
              eq(playerIdentifiers.type, 'license'),
              eq(playerIdentifiers.value, identifiers.license),
            ),
          )
          .get();

        const identifierRows = Object.entries(identifiers)
          .filter(([_, value]) => value !== undefined && value !== null)
          .map(([type, value]) => ({
            type,
            value,
          }));

        if (existingIdentifier) {
          const playerId = existingIdentifier.playerId;

          const [updatedPlayer] = await tx
            .update(players)
            .set({ name, lastSeen: now })
            .where(eq(players.id, playerId))
            .returning();

          if (identifierRows.length > 0) {
            await tx
              .insert(playerIdentifiers)
              .values(identifierRows.map((row) => ({ ...row, playerId })))
              // skip insert if conflict occurs
              .onConflictDoNothing();
          }

          return [updatedPlayer];
        } else {
          const [newPlayer] = await tx
            .insert(players)
            .values({ name, firstSeen: now, lastSeen: now })
            .returning();

          await tx
            .insert(playerIdentifiers)
            .values(identifierRows.map((row) => ({ ...row, playerId: newPlayer.id })))
            .onConflictDoNothing();

          return [newPlayer];
        }
      });
    },

    findById(id: number) {
      return db.select().from(players).where(eq(players.id, id)).get();
    },

    list(page = 1, pageSize = 50) {
      return db
        .select()
        .from(players)
        .orderBy(desc(players.lastSeen))
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .all();
    },
  };
}
