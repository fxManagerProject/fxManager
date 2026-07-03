import { useEffect, useState } from 'react';
import { QueryService } from '@/lib/query';

interface RecommendedArtifactResponse {
	recommended: string | null;
}

export function useRecommendedArtifact(): string | null {
	const [recommended, setRecommended] = useState<string | null>(null);

	useEffect(() => {
		let active = true;

		QueryService<RecommendedArtifactResponse>({
			endpoint: '/server/artifact/recommended',
			method: 'GET',
		})
			.then((res) => {
				if (active) setRecommended(res.recommended);
			})
			.catch(() => {});

		return () => {
			active = false;
		};
	}, []);

	return recommended;
}
