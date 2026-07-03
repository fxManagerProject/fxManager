import { playerManager } from '../monitoring';

const TX_SERVER_SHUTTING_DOWN = 'txAdmin:events:serverShuttingDown';
const DEFAULT_REASON = 'Server is shutting down.';

on(TX_SERVER_SHUTTING_DOWN, (data: { message?: string }) => {
	playerManager.dropAll(data?.message ?? DEFAULT_REASON);
});
