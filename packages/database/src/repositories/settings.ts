import { eq } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { settings } from '../schema';
import type * as schema from '../schema';

type DB = BunSQLiteDatabase<typeof schema>;

export const EDITABLE_SETTINGS_KEYS = [
	'executable',
	'serverDataPath',
	'serverConfigFile',
	'onesync',
] as const;

export function createSettingsRepository(db: DB) {
	return {
		get<T = unknown>(key: string): T | undefined {
			const row = db.select().from(settings).where(eq(settings.key, key)).get();
			return row?.value as T | undefined;
		},

		set(key: (typeof EDITABLE_SETTINGS_KEYS)[number], value: unknown) {
			if (!EDITABLE_SETTINGS_KEYS.includes(key)) {
				throw new Error(`The setting "${key}" is not listed as editable.`);
			}

			return db
				.insert(settings)
				.values({ key, value, updatedAt: new Date() })
				.onConflictDoUpdate({
					target: settings.key,
					set: { value, updatedAt: new Date() },
				})
				.returning()
				.get();
		},

		all() {
			return db.select().from(settings).all();
		},
	};
}
