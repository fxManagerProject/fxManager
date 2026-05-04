import { desc } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { auditLog } from '../schema';
import type * as schema from '../schema';

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
		action: string;
		target?: string;
		metadata?: Record<string, unknown>;
	}) {
		return this.db
			.insert(auditLog)
			.values({ ...input, createdAt: new Date() })
			.returning()
			.get();
	}

	list(page = 1, pageSize = 100) {
		return this.db
			.select()
			.from(auditLog)
			.orderBy(desc(auditLog.createdAt))
			.limit(pageSize)
			.offset((page - 1) * pageSize)
			.all();
	}
}

export function createAuditRepository(db: DB) {
	return AuditRepository.getInstance(db);
}
