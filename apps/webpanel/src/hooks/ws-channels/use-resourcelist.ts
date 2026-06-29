import { useEffect, useState } from 'react';
import { useWSBase } from './use-ws-core';
import type {
	ResourceData,
	ResourceInitialData,
} from '@fxmanager/shared/types';

interface UseResourcelistReturn {
	resources: ResourceData[];
	loading: boolean;
	status: boolean | 'errored';
}

export function useResourcelistSocket(): UseResourcelistReturn {
	const { subscribe, unsubscribe, on } = useWSBase();
	const [loading, setLoading] = useState<boolean>(true);
	const [status, setStatus] = useState<UseResourcelistReturn['status']>(false);
	const [resources, setResources] = useState<ResourceData[]>([]);

	useEffect(() => {
		subscribe('resourcelist');

		const offSync = on<ResourceInitialData>(
			'resourcelist',
			'initial',
			({ data }) => {
				setResources(data.resourcelist);
				setStatus(data.status);
				setLoading(false);
			},
		);

		const offRefresh = on<ResourceInitialData>(
			'resourcelist',
			'refresh',
			({ data }) => {
				setResources(data.resourcelist);
				setStatus(data.status);
				setLoading(false);
			},
		);

		const offUpdate = on<ResourceData>('resourcelist', 'update', ({ data }) => {
			setResources((prev) => {
				const idx = prev.findIndex((res) => res.name === data.name);

				if (idx < 0) {
					return [...prev, data];
				} else {
					const next = [...prev];
					next[idx] = data;
					return next;
				}
			});
		});

		return () => {
			offSync();
			offRefresh();
			offUpdate();
			unsubscribe('resourcelist');
		};
	}, [subscribe, unsubscribe, on]);

	return {
		resources,
		loading,
		status,
	};
}
