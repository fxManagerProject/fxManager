import { useEffect, useState } from 'react';
import { QueryService } from '@/lib/query';
import type { ContributorSummary } from '@fxmanager/shared/types';

export function useContributorsList(): {
	loading: boolean;
	contributors: ContributorSummary | null;
} {
	const [contributors, setContributors] = useState<ContributorSummary | null>(
		null,
	);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let active = true;

		QueryService<ContributorSummary>({
			endpoint: '/contributors',
			method: 'GET',
		})
			.then((res) => {
				if (active) setContributors(res);
			})
			.catch(() => {})
			.finally(() => setLoading(false));

		return () => {
			active = false;
		};
	}, []);

	return { loading, contributors };
}
