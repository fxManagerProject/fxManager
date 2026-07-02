import { QueryService } from '@/lib/query';
import type { AdminGroup, ApiResponse } from '@fxmanager/shared/types';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export type AdminGroupEntry = AdminGroup & {
	memberCount: number;
	createdAt: string | Date;
};

export function useGroups() {
	const [groups, setGroups] = useState<AdminGroupEntry[]>([]);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		try {
			const response = await QueryService<ApiResponse<AdminGroupEntry[]>>({
				endpoint: '/settings/groups',
				method: 'GET',
			});

			if (response.success) {
				setGroups(response.data);
			} else {
				toast.error(response.error);
			}
		} catch (err) {
			toast.error('Failed to load groups', {
				description: (err as Error).message,
			});
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { groups, loading, refresh };
}
