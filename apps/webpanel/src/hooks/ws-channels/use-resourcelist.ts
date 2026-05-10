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

// const MOCK_RESOURCELIST: ResourceData[] = [
// 	{
// 		name: 'ox_lib',
// 		version: '3.16.2',
// 		author: 'Overextended',
// 		description: 'A UI and back-end library for FiveM resources.',
// 		repository: 'https://github.com/overextended/ox_lib',
// 		path: 'resources/[ox]/ox_lib',
// 		status: 'started',
// 	},
// 	{
// 		name: 'ox_inventory',
// 		version: '2.42.0',
// 		author: 'Overextended',
// 		description: 'A metadata-based inventory system for FiveM.',
// 		repository: 'https://github.com/overextended/ox_inventory',
// 		path: 'resources/[ox]/ox_inventory',
// 		status: 'started',
// 	},
// 	{
// 		name: 'ox_doorlock',
// 		version: '1.14.3',
// 		author: 'Overextended',
// 		description: 'Advanced doorlock system for FiveM and RedM.',
// 		repository: 'https://github.com/overextended/ox_doorlock',
// 		path: 'resources/[ox]/ox_doorlock',
// 		status: 'stopped',
// 	},
// 	{
// 		name: 'ox_target',
// 		version: '1.10.0',
// 		author: 'Overextended',
// 		description: 'A high-performance targeting solution.',
// 		repository: 'https://github.com/overextended/ox_target',
// 		path: 'resources/[ox]/ox_target',
// 		status: 'started',
// 	},
// 	{
// 		name: 'ox_fuel',
// 		version: null,
// 		author: 'Overextended',
// 		description: 'Simple and efficient fuel system.',
// 		repository: 'https://github.com/overextended/ox_fuel',
// 		path: 'resources/[ox]/ox_fuel',
// 		status: 'stopped',
// 	},
// ];

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
