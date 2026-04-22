import { desc } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { auditLog } from '../schema';
import type { AuditAction } from '@fxmanager/shared/types';
import type * as schema from '../schema';

type DB = BunSQLiteDatabase<typeof schema>;

export function createAuditRepository(db: DB) {
	return {
		log(input: {
			adminId?: number;
			action: AuditAction;
			target?: string;
			metadata?: Record<string, unknown>;
		}) {
			return db
				.insert(auditLog)
				.values({ ...input, createdAt: new Date() })
				.returning()
				.get();
		},

		list(page = 1, pageSize = 100) {
			return db
				.select()
				.from(auditLog)
				.orderBy(desc(auditLog.createdAt))
				.limit(pageSize)
				.offset((page - 1) * pageSize)
				.all();
		},
	};
}
