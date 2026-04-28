import { useEffect, useRef, useState } from 'react';
import { useWSBase } from './use-ws-core';
import type { ProcessOutputLine } from '@fxmanager/shared/types';

interface UseConsoleOptions {
	maxLines?: number;
}

interface UseConsoleReturn {
	lines: ProcessOutputLine[];
	sendCommand: (command: string) => void;
	clear: () => void;
}

export function useConsoleSocket({
	maxLines = 500,
}: UseConsoleOptions = {}): UseConsoleReturn {
	const { subscribe, unsubscribe, on, emit } = useWSBase();
	const [lines, setLines] = useState<ProcessOutputLine[]>([]);
	// Persist lines across re-mounts (page navigation) via a ref-backed cache
	const cache = useRef<ProcessOutputLine[]>([]);

	useEffect(() => {
		// Restore cached lines on mount so navigating away and back doesn't lose history
		if (cache.current.length > 0) setLines(cache.current);

		subscribe('console');

		// Server dumps last N lines on subscribe via a 'history' event
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

		const offLine = on<ProcessOutputLine>('console', 'line', ({ data }) => {
			setLines((prev) => {
				const next = [...prev, data].slice(-maxLines);
				cache.current = next;
				return next;
			});
		});

		return () => {
			offLine();
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
