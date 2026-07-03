import { useEffect, useRef, useState } from 'react';
import { useWSBase } from './use-ws-core';
import type { ProcessOutputLine } from '@fxmanager/shared/types';

interface UseConsoleOptions {
	maxLines?: number;
	suspendTrim?: boolean;
}

const TRIM_OVERSHOOT = 1000;

interface UseConsoleReturn {
	lines: ProcessOutputLine[];
	sendCommand: (command: string) => void;
	clear: () => void;
}

export function useConsoleSocket({
	maxLines = 500,
	suspendTrim = false,
}: UseConsoleOptions = {}): UseConsoleReturn {
	const { subscribe, unsubscribe, on, emit } = useWSBase();
	const [lines, setLines] = useState<ProcessOutputLine[]>([]);
	// Persist lines across re-mounts (page navigation) via a ref-backed cache
	const cache = useRef<ProcessOutputLine[]>([]);
	const suspendTrimRef = useRef(suspendTrim);

	useEffect(() => {
		suspendTrimRef.current = suspendTrim;
	}, [suspendTrim]);

	useEffect(() => {
		// Restore cached lines on mount so navigating away and back doesn't lose history
		if (cache.current.length > 0) setLines(cache.current);

		subscribe('console');

		// Server dumps last N lines on subscribe via an 'initial' event
		const offInitial = on<ProcessOutputLine[]>(
			'console',
			'initial',
			({ data }) => {
				setLines(() => {
					const merged = data.slice(-maxLines);
					cache.current = merged;
					return merged;
				});
			},
		);

		const offLines = on<ProcessOutputLine[]>('console', 'lines', ({ data }) => {
			setLines((prev) => {
				const lastSeq = prev.length > 0 ? prev[prev.length - 1].seq : -1;
				const fresh = data.filter((l) => l.seq > lastSeq);
				if (fresh.length === 0) return prev;
				const cap = suspendTrimRef.current
					? maxLines + TRIM_OVERSHOOT
					: maxLines;
				const next = [...prev, ...fresh].slice(-cap);
				cache.current = next;
				return next;
			});
		});

		return () => {
			offLines();
			offInitial();
			unsubscribe('console');
		};
	}, [subscribe, unsubscribe, on, maxLines]);

	const sendCommand = (command: string) => {
		emit('console', 'command', { command });
	};

	const clear = () => {
		setLines([]);
		cache.current = [];
	};

	return { lines, sendCommand, clear };
}
