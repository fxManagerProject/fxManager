import { eq, inArray } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { settings } from '../schema';
import type * as schema from '../schema';

type DB = BunSQLiteDatabase<typeof schema>;

export const UNEDITABLE_SETTINGS_KEYS = [] as const;

class SettingsRepository {
	private static instance: SettingsRepository;

	private constructor(private readonly db: DB) {}

	static getInstance(db: DB): SettingsRepository {
		if (!SettingsRepository.instance) {
			SettingsRepository.instance = new SettingsRepository(db);
		}

		return SettingsRepository.instance;
	}

	get<T = string>(key: string): T | undefined {
		const row = this.db
			.select()
			.from(settings)
			.where(eq(settings.key, key))
			.get();
		return row?.value as T | undefined;
	}

	getMultiple<T = string, K extends string = string>(
		keys: readonly K[],
	): Record<K, T | undefined> {
		if (keys.length === 0) {
			return {} as Record<K, T | undefined>;
		}

		const rows = this.db
			.select()
			.from(settings)
			.where(inArray(settings.key, keys))
			.all();

		return keys.reduce<Record<K, T | undefined>>(
			(acc, key) => {
				acc[key] = rows.find((row) => row.key === key)?.value as T | undefined;
				return acc;
			},
			{} as Record<K, T | undefined>,
		);
	}

	set(key: string, value: unknown) {
		if (UNEDITABLE_SETTINGS_KEYS.includes(key as never)) {
			throw new Error(`The setting "${key}" is listed as uneditable.`);
		}

		return this.db
			.insert(settings)
			.values({ key, value, updatedAt: new Date() })
			.onConflictDoUpdate({
				target: settings.key,
				set: { value, updatedAt: new Date() },
			})
			.returning()
			.get();
	}

	all() {
		return this.db.select().from(settings).all();
	}
}

export function createSettingsRepository(db: DB) {
	return SettingsRepository.getInstance(db);
}
