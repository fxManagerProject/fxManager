import { useEffect, useState } from 'react';
import { QueryService } from '@/lib/query';

export interface VersionStatus {
	current: string;
	latest: string | null;
	latestUrl: string | null;
	updateAvailable: boolean;
	isBeta: boolean;
	isDev: boolean;
}

export function useVersionStatus(): VersionStatus | null {
	const [version, setVersion] = useState<VersionStatus | null>(null);

	useEffect(() => {
		let active = true;

		QueryService<VersionStatus>({
			endpoint: '/server/version',
			method: 'GET',
		})
			.then((res) => {
				if (active) setVersion(res);
			})
			.catch(() => {});

		return () => {
			active = false;
		};
	}, []);

	return version;
}
