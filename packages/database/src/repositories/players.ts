import { eq, desc, and, inArray, isNull, or, gt, sql } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { adminUsers, bans, players, playerIdentifiers } from '../schema';
import type * as schema from '../schema';
import { Ban, Player, PlayerIdentifiers } from '@fxmanager/types';

type DB = BunSQLiteDatabase<typeof schema>;

export function createPlayersRepository(db: DB) {
  return {
    isStaff(playerId: number): boolean {
      const result = db
        .select({ id: sql<number>`1` }) 
        .from(adminUsers)
        .where(eq(adminUsers.playerId, playerId))
        .limit(1)
        .get();

      return !!result;
    },

    findByLicense(license: string): Player | null {
      const result = db
        .select({ player: players })
        .from(players)
        .innerJoin(playerIdentifiers, eq(playerIdentifiers.playerId, players.id))
        .where(and(eq(playerIdentifiers.type, 'license'), eq(playerIdentifiers.value, license)))
        .get();

      if (!result) return null;

      const identifierRows = db
        .select()
        .from(playerIdentifiers)
        .where(eq(playerIdentifiers.playerId, result.player.id))
        .all();

      const identifiers = identifierRows.reduce((acc, curr) => {
        acc[curr.type as keyof PlayerIdentifiers] = curr.value;

        return acc;
      }, {} as PlayerIdentifiers);

      const isStaff = this.isStaff(result.player.id);

      return { ...result.player, isStaff, identifiers };
    },

    /* ToDo:
     * Consideration, if a player has the same identifier as another drop ? Deny connection ?
     */

    async upsert(name: string, identifiers: PlayerIdentifiers): Promise<Player> {
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
          const isStaff = this.isStaff(playerId);

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

          return { ...updatedPlayer, isStaff, identifiers };
        } else {
          const [newPlayer] = await tx
            .insert(players)
            .values({ name, firstSeen: now, lastSeen: now })
            .returning();

          await tx
            .insert(playerIdentifiers)
            .values(identifierRows.map((row) => ({ ...row, playerId: newPlayer.id })))
            .onConflictDoNothing();

          return { ...newPlayer, isStaff: false, identifiers };
        }
      });
    },

    checkBanned(identifiers: PlayerIdentifiers): Ban | null {
      const now = new Date();

      const identifierValues = Object.values(identifiers).filter(Boolean);

      if (identifierValues.length === 0) return null;

      const activeBan = db
        .select({
          id: bans.id,
          playerId: bans.playerId,
          reason: bans.reason,
          bannedBy: bans.bannedBy,
          createdAt: bans.createdAt,
          expiresAt: bans.expiresAt,
        })
        .from(bans)
        .innerJoin(playerIdentifiers, eq(bans.playerId, playerIdentifiers.playerId))
        .where(
          and(
            inArray(playerIdentifiers.value, identifierValues),
            isNull(bans.revokedAt),
            or(isNull(bans.expiresAt), gt(bans.expiresAt, now)),
          ),
        )
        .limit(1)
        .get();

      return activeBan ?? null;
    },

    updatePlaytime(playerId: number, playtime: number) {
      const now = new Date();

      db.update(players).set({ lastSeen: now, playtime }).where(eq(players.id, playerId));
    },

    findById(id: number): Player | null {
      const player = db.select().from(players).where(eq(players.id, id)).get();

      if (!player) return null;

      const identifierRows = db
        .select()
        .from(playerIdentifiers)
        .where(eq(playerIdentifiers.playerId, id))
        .all();

      const identifiers = identifierRows.reduce((acc, curr) => {
        acc[curr.type as keyof PlayerIdentifiers] = curr.value;

        return acc;
      }, {} as PlayerIdentifiers);

      const isStaff = this.isStaff(player.id);

      return { ...player, isStaff, identifiers };
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
