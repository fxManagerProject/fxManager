export type JournalPlan =
	| { action: 'up-to-date' }
	| { action: 'register'; pending: number[] }
	| { action: 'error'; orphanRegistryVersions: number[] };

export function planJournalMigrations(
	journalVersions: number[],
	registryVersions: number[],
): JournalPlan {
	const journalSet = new Set(journalVersions);
	const registrySet = new Set(registryVersions);

	const orphanRegistryVersions = registryVersions.filter(
		(v) => !journalSet.has(v),
	);
	if (orphanRegistryVersions.length > 0) {
		return { action: 'error', orphanRegistryVersions };
	}

	const pending = journalVersions.filter((v) => !registrySet.has(v));
	if (pending.length === 0) {
		return { action: 'up-to-date' };
	}

	return { action: 'register', pending };
}
