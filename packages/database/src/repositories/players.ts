import {
	eq,
	desc,
	and,
	inArray,
	isNull,
	or,
	gt,
	sql,
	asc,
	like,
} from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import {
	adminUsers,
	bans,
	players,
	playerIdentifiers,
	warns,
	kicks,
	playerNotes,
} from '../schema';
import type * as schema from '../schema';
import type {
	PaginatedResponse,
	Player,
	PlayerIdentifiers,
} from '@fxmanager/shared/types';
import type { Ban, PlayerProfile } from '../types';

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
				.innerJoin(
					playerIdentifiers,
					eq(playerIdentifiers.playerId, players.id),
				)
				.where(
					and(
						eq(playerIdentifiers.type, 'license'),
						eq(playerIdentifiers.value, license),
					),
				)
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

		async upsert(
			name: string,
			identifiers: PlayerIdentifiers,
		): Promise<Player> {
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
						.values(
							identifierRows.map((row) => ({ ...row, playerId: newPlayer.id })),
						)
						.onConflictDoNothing();

					return { ...newPlayer, isStaff: false, identifiers };
				}
			});
		},

		checkBanned(identifiers: PlayerIdentifiers): Omit<Ban, 'revokedAt'> | null {
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
				.innerJoin(
					playerIdentifiers,
					eq(bans.playerId, playerIdentifiers.playerId),
				)
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

			db.update(players)
				.set({ lastSeen: now, playtime })
				.where(eq(players.id, playerId))
				.run();
		},

		async findById(id: number): Promise<PlayerProfile | null> {
			const result = await db.query.players.findFirst({
				where: eq(players.id, id),
				with: {
					identifiers: true,
					adminProfile: {
						columns: {
							passwordHash: false,
						},
					},
					bans: true,
					warns: true,
					kicks: true,
					notes: true,
					reports: true,
				},
			});

			if (!result) return null;

			const identifiers = result.identifiers.reduce((acc, curr) => {
				acc[curr.type as keyof PlayerIdentifiers] = curr.value;
				return acc;
			}, {} as PlayerIdentifiers);

			return {
				...result,
				isStaff: !!result.adminProfile,
				identifiers,
				punishments: {
					bans: result.bans,
					warns: result.warns,
					kicks: result.kicks,
				},
			};
		},

		list(
			page = 1,
			pageSize = 20,
			options?: {
				search?: string;
				sortBy?: 'playtime' | 'lastSeen' | 'firstSeen';
				sortOrder?: 'asc' | 'desc';
			},
		): PaginatedResponse<Omit<Player, 'identifiers'>> {
			const { search, sortBy = 'lastSeen', sortOrder = 'desc' } = options ?? {};

			const sortCol = {
				playtime: players.playtime,
				lastSeen: players.lastSeen,
				firstSeen: players.firstSeen,
			}[sortBy];

			const orderFn = sortOrder === 'asc' ? asc : desc;

			const filters = search
				? or(
						like(players.name, `%${search}%`),
						like(playerIdentifiers.value, `%${search}%`),
					)
				: undefined;

			const countQuery = db
				.select({ count: sql<number>`count(distinct ${players.id})` })
				.from(players);

			if (search) {
				countQuery
					.leftJoin(
						playerIdentifiers,
						eq(playerIdentifiers.playerId, players.id),
					)
					.where(filters)
					.groupBy(players.id);
			}

			const totalResult = countQuery.get();
			const total = totalResult?.count ?? 0;

			let query = db
				.select({
					id: players.id,
					name: players.name,
					playtime: players.playtime,
					lastSeen: players.lastSeen,
					firstSeen: players.firstSeen,
					isStaff: sql<
						1 | 0
					>`CASE WHEN ${adminUsers.playerId} IS NOT NULL THEN 1 ELSE 0 END`,
				})
				.from(players)
				.leftJoin(adminUsers, eq(players.id, adminUsers.playerId))
				.$dynamic();

			if (search) {
				query = query
					.leftJoin(
						playerIdentifiers,
						eq(playerIdentifiers.playerId, players.id),
					)
					.where(filters)
					.groupBy(players.id);
			}

			const response = query
				.orderBy(orderFn(sortCol))
				.limit(pageSize)
				.offset((page - 1) * pageSize)
				.all();

			return {
				items: response.map((row) => ({ ...row, isStaff: row.isStaff === 1 })),
				total,
				page,
				pageSize,
			};
		},

		async updatePlayerNotes(
			playerId: number,
			adminId: number,
			content: string,
		) {
			const now = new Date();

			const playerNote = db
				.select({ id: playerNotes.id })
				.from(playerNotes)
				.where(
					and(
						eq(playerNotes.playerId, playerId),
						eq(playerNotes.issuer, adminId),
					),
				)
				.get();

			if (playerNote) {
				if (content.trim()) {
					db.update(playerNotes)
						.set({ content, issuedAt: now })
						.where(
							and(
								eq(playerNotes.playerId, playerId),
								eq(playerNotes.issuer, adminId),
							),
						)
						.run();
				} else {
					await db
						.delete(playerNotes)
						.where(
							and(
								eq(playerNotes.playerId, playerId),
								eq(playerNotes.issuer, adminId),
							),
						);
				}
			} else if (content.length > 3) {
				await db
					.insert(playerNotes)
					.values({ playerId, content, issuer: adminId, issuedAt: now });
			} else {
				throw new Error('content_too_short');
			}

			return true;
		},

		async addBan(
			playerId: number,
			expiresAt: Date | null,
			reason: string,
			adminUsername: string,
		) {
			const now = new Date();

			const activeBan = db
				.select({ id: bans.id, expiresAt: bans.expiresAt })
				.from(bans)
				.where(
					and(
						eq(bans.playerId, playerId),
						isNull(bans.revokedAt),
						or(isNull(bans.expiresAt), gt(bans.expiresAt, now)),
					),
				)
				.get();

			if (activeBan) {
				// no adding new ban if perma-banned
				if (activeBan.expiresAt === null) return false;

				// what's the point in adding a ban shorter then the active one
				if (expiresAt !== null && activeBan.expiresAt >= expiresAt)
					return false;

				// shorten the active one, only have 1 active ban at a time
				await db
					.update(bans)
					.set({ expiresAt: now })
					.where(eq(bans.id, activeBan.id))
					.run();
			}

			await db.insert(bans).values({
				playerId,
				expiresAt,
				bannedBy: adminUsername,
				reason,
				createdAt: now,
			});

			return true;
		},

		async addKick(playerId: number, reason: string, adminId: number) {
			await db.insert(kicks).values({
				playerId,
				reason,
				issuer: adminId,
				issuedAt: new Date(),
			});
		},

		async addWarn(playerId: number, reason: string, adminId: number) {
			await db.insert(warns).values({
				playerId,
				reason,
				issuer: adminId,
				issuedAt: new Date(),
			});
		},
	};
}
