import { asc, desc, eq, like, or, sql } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import {
	whitelistedIdentifers,
	adminUsers,
	players,
	playerIdentifiers,
} from '../schema';
import type * as schema from '../schema';
import type {
	PaginatedResponse,
	PlayerIdentifiers,
	WhitelistEntry,
} from '@fxmanager/shared/types';

type DB = BunSQLiteDatabase<typeof schema>;

class WhitelistRepository {
	private static instance: WhitelistRepository;

	private constructor(private readonly db: DB) {}

	static getInstance(db: DB): WhitelistRepository {
		if (!WhitelistRepository.instance) {
			WhitelistRepository.instance = new WhitelistRepository(db);
		}

		return WhitelistRepository.instance;
	}

	async isAnyIdentifierWhitelisted(
		identifiers: PlayerIdentifiers,
	): Promise<boolean> {
		const conditions = [eq(whitelistedIdentifers.value, identifiers.license)];

		if (identifiers.fivem) {
			conditions.push(eq(whitelistedIdentifers.value, identifiers.fivem));
		}
		if (identifiers.discord) {
			conditions.push(eq(whitelistedIdentifers.value, identifiers.discord));
		}
		if (identifiers.steam) {
			conditions.push(eq(whitelistedIdentifers.value, identifiers.steam));
		}

		const result = await this.db
			.select({ id: whitelistedIdentifers.id })
			.from(whitelistedIdentifers)
			.where(or(...conditions))
			.limit(1);

		return result.length > 0;
	}

	async list(
		page = 1,
		pageSize = 20,
		options?: {
			search?: string;
			sortBy?: 'addedAt' | 'value';
			sortOrder?: 'asc' | 'desc';
		},
	): Promise<PaginatedResponse<WhitelistEntry>> {
		const { search, sortBy = 'addedAt', sortOrder = 'desc' } = options ?? {};

		const orderFn = sortOrder === 'asc' ? asc : desc;
		const sortCol =
			sortBy === 'value'
				? whitelistedIdentifers.value
				: whitelistedIdentifers.addedAt;

		const filters = search
			? or(
					like(whitelistedIdentifers.value, `%${search}%`),
					like(adminUsers.username, `%${search}%`),
					like(players.name, `%${search}%`),
				)
			: undefined;

		const countResult = this.db
			.select({
				count: sql<number>`count(DISTINCT ${whitelistedIdentifers.id})`,
			})
			.from(whitelistedIdentifers)
			.leftJoin(adminUsers, eq(whitelistedIdentifers.adminId, adminUsers.id))
			.leftJoin(
				playerIdentifiers,
				eq(whitelistedIdentifers.value, playerIdentifiers.value),
			)
			.leftJoin(players, eq(playerIdentifiers.playerId, players.id))
			.where(filters)
			.get();

		const total = countResult?.count ?? 0;

		const rows = await this.db
			.select({
				id: whitelistedIdentifers.id,
				type: whitelistedIdentifers.type,
				value: whitelistedIdentifers.value,
				addedAt: whitelistedIdentifers.addedAt,
				addedByAdmin: adminUsers.username,
				playerName: players.name,
				system: whitelistedIdentifers.system,
			})
			.from(whitelistedIdentifers)
			.leftJoin(adminUsers, eq(whitelistedIdentifers.adminId, adminUsers.id))
			.leftJoin(
				playerIdentifiers,
				eq(whitelistedIdentifers.value, playerIdentifiers.value),
			)
			.leftJoin(players, eq(playerIdentifiers.playerId, players.id))
			.where(filters)
			.orderBy(orderFn(sortCol))
			.limit(pageSize)
			.offset((page - 1) * pageSize)
			.all();

		return {
			items: rows.map((row) => ({
				id: row.id,
				type: row.type,
				value: row.value,
				addedAt: row.addedAt,
				addedByAdmin:
					row.system === 1 ? 'system' : (row.addedByAdmin ?? 'deleted_admin'),
				playerName: row.playerName ?? 'N/A',
			})),
			total,
			page,
			pageSize,
		};
	}

	add(data: {
		type: string;
		value: string;
		adminId?: number;
		system?: boolean;
	}): true {
		let regex: RegExp | null = null;

		if (data.type === 'discord') {
			regex = /^discord:[0-9]+$/;
		} else if (data.type === 'license') {
			regex = /^license:[a-f0-9]+$/i;
		} else if (data.type === 'fivem') {
			regex = /^fivem:[0-9]+$/;
		} else if (data.type === 'steam') {
			regex = /^steam:[a-f0-9]+$/i;
		}

		if (regex && !regex.test(data.value)) {
			throw new Error(`invalid_format`);
		} else if (!regex) {
			throw new Error('unsupported_type');
		}

		const result = this.db
			.insert(whitelistedIdentifers)
			.values({
				type: data.type,
				value: data.value,
				adminId: data.adminId,
				system: data.system ? 1 : 0,
			})
			.onConflictDoNothing()
			.returning()
			.get();

		if (result) {
			return true;
		} else {
			throw new Error('already_whitelisted');
		}
	}

	revoke(id: number) {
		return this.db
			.delete(whitelistedIdentifers)
			.where(eq(whitelistedIdentifers.id, id))
			.returning()
			.get();
	}
}

export function createWhitelistRepository(db: DB) {
	return WhitelistRepository.getInstance(db);
}
