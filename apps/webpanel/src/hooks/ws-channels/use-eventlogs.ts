import { useCallback, useEffect, useRef, useState } from 'react';
import { useWSBase } from './use-ws-core';
import type { EventLogEntry } from '@fxmanager/shared/types';

const DEFAULT_MAX = 1000;
const TRIM_OVERSHOOT = 500;

type EventFilter = (entry: EventLogEntry) => boolean;

interface UseEventLogsOptions {
	maxEntries?: number;
}

interface UseEventLogsReturn {
	entries: EventLogEntry[];
	loading: boolean;
	/** Set a client-side filter function. Pass `null` to clear. */
	setFilter: (fn: EventFilter | null) => void;
	/** Return all entries that match the current filter. */
	filtered: EventLogEntry[];
}

export function useEventLogsSocket({
	maxEntries = DEFAULT_MAX,
}: UseEventLogsOptions = {}): UseEventLogsReturn {
	const { subscribe, unsubscribe, on } = useWSBase();
	const [loading, setLoading] = useState(true);
	const [entries, setEntries] = useState<EventLogEntry[]>([]);
	const [filter, setFilter] = useState<EventFilter | null>(null);
	const maxRef = useRef(maxEntries);

	useEffect(() => {
		maxRef.current = maxEntries;
	}, [maxEntries]);

	useEffect(() => {
		subscribe('eventlogs');

		const offInitial = on<EventLogEntry[]>(
			'eventlogs',
			'initial',
			({ data }) => {
				setEntries(data.slice(-maxRef.current));
				setLoading(false);
			},
		);

		const offEntry = on<EventLogEntry>('eventlogs', 'entry', ({ data }) => {
			setEntries((prev) => {
				const cap = maxRef.current + TRIM_OVERSHOOT;
				return [...prev, data].slice(-cap);
			});
		});

		const offBatch = on<EventLogEntry[]>('eventlogs', 'batch', ({ data }) => {
			setEntries((prev) => {
				const cap = maxRef.current + TRIM_OVERSHOOT;
				return [...prev, ...data].slice(-cap);
			});
		});

		return () => {
			offInitial();
			offEntry();
			offBatch();
			unsubscribe('eventlogs');
		};
	}, [subscribe, unsubscribe, on]);

	const filtered = filter ? entries.filter(filter) : entries;

	return {
		entries,
		loading,
		setFilter: useCallback((fn: EventFilter | null) => setFilter(() => fn), []),
		filtered,
	};
}
