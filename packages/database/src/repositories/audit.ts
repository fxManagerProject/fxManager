import {
	type SQL,
	and,
	desc,
	eq,
	gte,
	inArray,
	like,
	lte,
	sql,
} from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { auditLog, adminUsers, players } from '../schema';
import type * as schema from '../schema';
import type {
	AuditLogAction,
	PaginatedResponse,
} from '@fxmanager/shared/types';
import type { AuditLog } from '../types';

type DB = BunSQLiteDatabase<typeof schema>;

class AuditRepository {
	private static instance: AuditRepository;

	private constructor(private readonly db: DB) {}

	static getInstance(db: DB): AuditRepository {
		if (!AuditRepository.instance) {
			AuditRepository.instance = new AuditRepository(db);
		}

		return AuditRepository.instance;
	}

	log(input: {
		adminId?: number;
		action: AuditLogAction;
		playerId?: number;
		metadata?: Record<string, unknown>;
	}) {
		return this.db
			.insert(auditLog)
			.values({ ...input, createdAt: new Date() })
			.returning()
			.get();
	}

	async list(
		page: number = 1,
		pageSize: number = 50,
		action?: AuditLogAction | AuditLogAction[],
		target?: string,
		admins?: number[],
		dateFrom?: Date,
		dateTo?: Date,
	): Promise<PaginatedResponse<AuditLog>> {
		const offset = (page - 1) * pageSize;

		const conditions: SQL<unknown>[] = [];

		if (action) {
			if (Array.isArray(action)) {
				conditions.push(inArray(auditLog.action, action));
			} else {
				conditions.push(eq(auditLog.action, action));
			}
		}

		if (target) {
			conditions.push(like(players.name, `%${target}%`));
		}

		if (admins !== undefined) {
			conditions.push(inArray(auditLog.adminId, admins));
		}

		if (dateFrom) {
			conditions.push(gte(auditLog.createdAt, dateFrom));
		}
		if (dateTo) {
			conditions.push(lte(auditLog.createdAt, dateTo));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const data = this.db
			.select({
				id: auditLog.id,
				admin: adminUsers.username,
				adminId: auditLog.adminId,
				action: auditLog.action,
				playerId: auditLog.playerId,
				player: players.name,
				metadata: auditLog.metadata,
				createdAt: auditLog.createdAt,
			})
			.from(auditLog)
			.leftJoin(adminUsers, eq(auditLog.adminId, adminUsers.id))
			.leftJoin(players, eq(players.id, auditLog.playerId))
			.where(whereClause)
			.orderBy(desc(auditLog.createdAt))
			.limit(pageSize)
			.offset(offset)
			.all();

		const countResult = this.db
			.select({ count: sql<number>`count(${auditLog.id})` })
			.from(auditLog)
			.leftJoin(adminUsers, eq(auditLog.adminId, adminUsers.id))
			.leftJoin(players, eq(players.id, auditLog.playerId))
			.where(whereClause)
			.get();

		const totalItems = countResult?.count ?? 0;

		return {
			items: data,
			total: totalItems,
			page,
			pageSize,
		};
	}
}

export function createAuditRepository(db: DB) {
	return AuditRepository.getInstance(db);
}
