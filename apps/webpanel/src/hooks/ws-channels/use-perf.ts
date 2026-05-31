import { useEffect, useState } from 'react';
import { PERF_WINDOW_MS, type PerfSnapshot } from '@fxmanager/shared/types';
import { useWSBase } from './use-ws-core';

/**
 * Subscribes to the `perf` channel: seeds the series from the initial backfill,
 * then appends each live `sample` broadcast, trimming to the last 30 min.
 */
export function usePerfSocket() {
	const { subscribe, unsubscribe, on } = useWSBase();
	const [samples, setSamples] = useState<PerfSnapshot[]>([]);

	useEffect(() => {
		subscribe('perf');

		const trim = (list: PerfSnapshot[]) => {
			const cutoff = Date.now() - PERF_WINDOW_MS;
			return list.filter((s) => s.ts >= cutoff);
		};

		const offInitial = on<PerfSnapshot[]>('perf', 'initial', ({ data }) => {
			setSamples(trim(data));
		});

		const offSample = on<PerfSnapshot>('perf', 'sample', ({ data }) => {
			setSamples((prev) => trim([...prev, data]));
		});

		return () => {
			offInitial();
			offSample();
			unsubscribe('perf');
		};
	}, [subscribe, unsubscribe, on]);

	return { samples };
}
