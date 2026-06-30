import { useCallback, useEffect, useState } from 'react';
import type {
	ApiResponse,
	RestartScheduleStatus,
} from '@fxmanager/shared/types';
import { QueryService } from '@/lib/query';
import { toast } from 'sonner';

const POLL_MS = 30_000;

export function useSchedule() {
	const [status, setStatus] = useState<RestartScheduleStatus | null>(null);

	const refresh = useCallback(async () => {
		try {
			const res = await QueryService<ApiResponse<RestartScheduleStatus>>({
				endpoint: '/server/schedule',
				method: 'GET',
			});
			if (res.success) setStatus(res.data);
		} catch {
			// best-effort; the rest of the card still works without the countdown
		}
	}, []);

	useEffect(() => {
		void refresh();
		const id = setInterval(() => void refresh(), POLL_MS);
		return () => clearInterval(id);
	}, [refresh]);

	const restartIn = useCallback(
		async (minutes: number) => {
			try {
				await QueryService({
					endpoint: '/server/schedule/restart-in',
					method: 'POST',
					body: { minutes },
				});
				toast.success(
					`Restart scheduled in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
				);
				await refresh();
			} catch {
				toast.error('Failed to schedule restart.');
			}
		},
		[refresh],
	);

	const skip = useCallback(async () => {
		try {
			const res = await QueryService<ApiResponse<{ skipped: boolean }>>({
				endpoint: '/server/schedule/skip',
				method: 'POST',
			});
			if (res.success && res.data.skipped) toast.success('Next restart cancelled.');
			else toast.info('No upcoming restart to cancel.');
			await refresh();
		} catch {
			toast.error('Failed to cancel restart.');
		}
	}, [refresh]);

	return { status, refresh, restartIn, skip };
}
