import { createContext, useContext, useEffect, useState } from 'react';
import type { WSContextValue } from '@/types/ws';
import type { Channel } from '@fxmanager/shared/types';

export const WSContext = createContext<WSContextValue | null>(null);

export function useWSBase(): WSContextValue {
	const ctx = useContext(WSContext);
	if (!ctx) throw new Error('useWS must be used inside WSProvider');
	return ctx;
}

export function useWsChannel<T>(channel: Channel, event: string, initial: T) {
	const { subscribe, unsubscribe, on } = useWSBase();
	const [state, setState] = useState<T>(initial);

	useEffect(() => {
		subscribe(channel);

		const offInitial = on<T>(channel, 'initial', (msg) => {
			setState(msg.data);
		});

		const off = on<T>(channel, event, (msg) => {
			setState(msg.data);
		});

		return () => {
			offInitial();
			off();
			unsubscribe(channel);
		};
	}, [channel, event, subscribe, unsubscribe, on]);

	return { state, setState };
}
