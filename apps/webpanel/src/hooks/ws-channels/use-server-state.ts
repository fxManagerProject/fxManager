import type { ServerState } from '@fxmanager/shared/types';
import { useWsChannel } from './use-ws-core';

const INITIAL: ServerState = {
	status: 'stopped',
	startedAt: null,
};

export function useServerStateSocket() {
	return useWsChannel<ServerState>('server_state', 'status_changed', INITIAL);
}
