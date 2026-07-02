import { QueryService } from '@/lib/query';
import type { AdminGroup, ApiResponse } from '@fxmanager/shared/types';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export type AdminGroupEntry = AdminGroup & {
	memberCount: number;
	createdAt: string | Date;
};

let cache: AdminGroupEntry[] | null = null;
let inFlight: Promise<AdminGroupEntry[]> | null = null;
const subscribers = new Set<(groups: AdminGroupEntry[]) => void>();

async function fetchGroups(): Promise<AdminGroupEntry[]> {
	const response = await QueryService<ApiResponse<AdminGroupEntry[]>>({
		endpoint: '/settings/groups',
		method: 'GET',
	});

	if (!response.success) throw new Error(response.error);
	return response.data;
}

function loadGroups(force = false): Promise<AdminGroupEntry[]> {
	if (!force && cache) return Promise.resolve(cache);

	if (!inFlight) {
		inFlight = fetchGroups()
			.then((groups) => {
				cache = groups;
				for (const notify of subscribers) notify(groups);
				return groups;
			})
			.finally(() => {
				inFlight = null;
			});
	}

	return inFlight;
}

export function useGroups() {
	const [groups, setGroups] = useState<AdminGroupEntry[]>(cache ?? []);
	const [loading, setLoading] = useState(cache === null);

	useEffect(() => {
		subscribers.add(setGroups);
		return () => {
			subscribers.delete(setGroups);
		};
	}, []);

	const load = useCallback((force: boolean) => {
		setLoading(true);
		return loadGroups(force)
			.then(setGroups)
			.catch((err) => {
				toast.error('Failed to load groups', {
					description: (err as Error).message,
				});
			})
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		if (cache) return;
		void load(false);
	}, [load]);

	const refresh = useCallback(() => load(true), [load]);

	return { groups, loading, refresh };
}
