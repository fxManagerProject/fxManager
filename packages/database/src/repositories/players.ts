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

class PlayersRepository {
	private static instance: PlayersRepository;

	private constructor(private readonly db: DB) {}

	static getInstance(db: DB): PlayersRepository {
		if (!PlayersRepository.instance) {
			PlayersRepository.instance = new PlayersRepository(db);
		}

		return PlayersRepository.instance;
	}

	isStaff(playerId: number): boolean {
		const result = this.db
			.select({ id: sql<number>`1` })
			.from(adminUsers)
			.where(eq(adminUsers.playerId, playerId))
			.limit(1)
			.get();

		return !!result;
	}

	findByIdentifier(
		type: keyof PlayerIdentifiers,
		value: string,
	): Player | null {
		const result = this.db
			.select({ player: players })
			.from(players)
			.innerJoin(playerIdentifiers, eq(playerIdentifiers.playerId, players.id))
			.where(
				and(
					eq(playerIdentifiers.type, type),
					eq(playerIdentifiers.value, value),
				),
			)
			.get();

		if (!result) return null;

		const identifierRows = this.db
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
	}

	findByLicense(license: string): Player | null {
		return this.findByIdentifier('license', license);
	}

	/* ToDo:
	 * Consideration, if a player has the same identifier as another drop ? Deny connection ?
	 */

	async upsert(name: string, identifiers: PlayerIdentifiers): Promise<Player> {
		const now = new Date();
		return this.db.transaction(async (tx) => {
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

				if (!updatedPlayer) throw new Error('Failed to update player');

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

				if (!newPlayer) throw new Error('Failed to insert player');

				await tx
					.insert(playerIdentifiers)
					.values(
						identifierRows.map((row) => ({ ...row, playerId: newPlayer.id })),
					)
					.onConflictDoNothing();

				const discordVal = identifierRows.find(
					(row) => row.type === 'discord',
				)?.value;
				const fivemVal = identifierRows.find(
					(row) => row.type === 'fivem',
				)?.value;
				const conditions = [
					discordVal ? eq(adminUsers.discordId, discordVal) : undefined,
					fivemVal ? eq(adminUsers.cfxId, fivemVal) : undefined,
				].filter(Boolean) as any;

				const staffCheck = await tx.query.adminUsers.findFirst({
					where: or(...conditions),
					columns: { id: true },
				});

				const isStaff = !!staffCheck;

				if (isStaff) {
					await tx.update(adminUsers)
						.set({ playerId: newPlayer.id })
						.where(eq(adminUsers.id, staffCheck.id));
				}

				return { ...newPlayer, isStaff, identifiers };
			}
		});
	}

	checkBanned(identifiers: PlayerIdentifiers): Omit<Ban, 'revokedAt'> | null {
		const now = new Date();

		const identifierValues = Object.values(identifiers).filter(Boolean);

		if (identifierValues.length === 0) return null;

		const activeBan = this.db
			.select({
				id: bans.id,
				playerId: bans.playerId,
				reason: bans.reason,
				issuer: bans.issuer,
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
	}

	updatePlaytime(playerId: number, playtime: number) {
		const now = new Date();

		this.db
			.update(players)
			.set({ lastSeen: now, playtime })
			.where(eq(players.id, playerId))
			.run();
	}

	async findById(id: number): Promise<PlayerProfile | null> {
		const result = await this.db.query.players.findFirst({
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

		const {
			bans: banRows,
			warns: warnRows,
			kicks: kickRows,
			notes: noteRows,
			reports: reportRows,
			identifiers: identifierRows,
			...player
		} = result;

		const identifiers = identifierRows.reduce((acc, curr) => {
			acc[curr.type as keyof PlayerIdentifiers] = curr.value;
			return acc;
		}, {} as PlayerIdentifiers);

		const issuerIds = [
			...new Set(
				[...banRows, ...warnRows, ...kickRows, ...noteRows]
					.map((row) => row.issuer)
					.filter((v): v is number => v != null),
			),
		];
		const reporterIds = [...new Set(reportRows.map((r) => r.reporterId))];

		const adminNames = new Map(
			issuerIds.length
				? this.db
						.select({ id: adminUsers.id, username: adminUsers.username })
						.from(adminUsers)
						.where(inArray(adminUsers.id, issuerIds))
						.all()
						.map((a) => [a.id, a.username] as const)
				: [],
		);
		const reporterNames = new Map(
			reporterIds.length
				? this.db
						.select({ id: players.id, name: players.name })
						.from(players)
						.where(inArray(players.id, reporterIds))
						.all()
						.map((p) => [p.id, p.name] as const)
				: [],
		);

		const withIssuerName = <T extends { issuer: number | null }>(row: T) => ({
			...row,
			issuerName:
				row.issuer != null ? (adminNames.get(row.issuer) ?? null) : null,
		});

		return {
			...player,
			isStaff: !!result.adminProfile,
			identifiers,
			punishments: {
				bans: banRows.map(withIssuerName),
				warns: warnRows.map(withIssuerName),
				kicks: kickRows.map(withIssuerName),
			},
			notes: noteRows.map(withIssuerName),
			reports: reportRows.map((r) => ({
				...r,
				reporterName: reporterNames.get(r.reporterId) ?? null,
			})),
		};
	}

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

		const countQuery = this.db
			.select({ count: sql<number>`count(distinct ${players.id})` })
			.from(players);

		if (search) {
			countQuery
				.leftJoin(playerIdentifiers, eq(playerIdentifiers.playerId, players.id))
				.where(filters)
				.groupBy(players.id);
		}

		const totalResult = countQuery.get();
		const total = totalResult?.count ?? 0;

		let query = this.db
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
				.leftJoin(playerIdentifiers, eq(playerIdentifiers.playerId, players.id))
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
	}

	async updatePlayerNotes(playerId: number, adminId: number, content: string) {
		const now = new Date();
		const trimmedContent = content.trim();

		return await this.db.transaction(async (tx) => {
			const player = tx
				.select()
				.from(players)
				.where(eq(players.id, playerId))
				.get();

			if (!player) {
				throw new Error('player_not_found');
			}

			const existingNote = tx
				.select({ id: playerNotes.id })
				.from(playerNotes)
				.where(
					and(
						eq(playerNotes.playerId, playerId),
						eq(playerNotes.issuer, adminId),
					),
				)
				.get();

			let finalNote: typeof playerNotes.$inferSelect | null = null;

			if (existingNote) {
				if (trimmedContent) {
					const [updated] = await tx
						.update(playerNotes)
						.set({ content: trimmedContent, issuedAt: now })
						.where(eq(playerNotes.id, existingNote.id))
						.returning();

					if (!updated) throw new Error('Failed to update note');

					finalNote = updated;
				} else {
					tx.delete(playerNotes)
						.where(eq(playerNotes.id, existingNote.id))
						.run();

					finalNote = null;
				}
			} else if (trimmedContent.length > 3) {
				const [inserted] = await tx
					.insert(playerNotes)
					.values({
						playerId,
						content: trimmedContent,
						issuer: adminId,
						issuedAt: now,
					})
					.returning();

				if (!inserted) throw new Error('Failed to insert note');

				finalNote = inserted;
			} else {
				throw new Error('content_too_short');
			}

			return {
				...finalNote,
				player,
			};
		});
	}

	async addBan(
		playerId: number,
		expiresAt: Date | null,
		reason: string,
		adminId: number | null,
	) {
		const now = new Date();

		return await this.db.transaction(async (tx) => {
			const playerExists = tx
				.select({ id: players.id })
				.from(players)
				.where(eq(players.id, playerId))
				.get();

			if (!playerExists) {
				throw new Error('player_not_found');
			}

			const activeBan = tx
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
				if (activeBan.expiresAt === null) return false;
				if (expiresAt !== null && activeBan.expiresAt >= expiresAt)
					return false;

				tx.update(bans)
					.set({ expiresAt: now })
					.where(eq(bans.id, activeBan.id))
					.run();
			}

			const [newBan] = await tx
				.insert(bans)
				.values({
					playerId,
					expiresAt,
					issuer: adminId,
					reason,
					createdAt: now,
				})
				.returning();

			const player = tx
				.select()
				.from(players)
				.where(eq(players.id, playerId))
				.get();

			return {
				...newBan,
				player,
			};
		});
	}

	async addKick(playerId: number, reason: string, adminId: number | null) {
		return await this.db.transaction(async (tx) => {
			const player = tx
				.select()
				.from(players)
				.where(eq(players.id, playerId))
				.get();

			if (!player) {
				throw new Error('player_not_found');
			}

			const [newKick] = await tx
				.insert(kicks)
				.values({
					playerId,
					reason,
					issuer: adminId,
					issuedAt: new Date(),
				})
				.returning();

			return {
				...newKick,
				player,
			};
		});
	}

	async addWarn(playerId: number, reason: string, adminId: number | null) {
		return await this.db.transaction(async (tx) => {
			const player = tx
				.select()
				.from(players)
				.where(eq(players.id, playerId))
				.get();

			if (!player) {
				throw new Error('player_not_found');
			}

			const [newWarn] = await tx
				.insert(warns)
				.values({
					playerId,
					reason,
					issuer: adminId,
					issuedAt: new Date(),
				})
				.returning();

			return {
				...newWarn,
				player,
			};
		});
	}

	revokeWarn(warnId: number, playerId?: number) {
		return this.db
			.update(warns)
			.set({ revoked: 1 })
			.where(
				and(
					eq(warns.id, warnId),
					eq(warns.revoked, 0),
					playerId !== undefined ? eq(warns.playerId, playerId) : undefined,
				),
			)
			.returning()
			.get();
	}

	revokeKick(kickId: number, playerId?: number) {
		return this.db
			.update(kicks)
			.set({ revoked: 1 })
			.where(
				and(
					eq(kicks.id, kickId),
					eq(kicks.revoked, 0),
					playerId !== undefined ? eq(kicks.playerId, playerId) : undefined,
				),
			)
			.returning()
			.get();
	}
}

export function createPlayersRepository(db: DB) {
	return PlayersRepository.getInstance(db);
}
