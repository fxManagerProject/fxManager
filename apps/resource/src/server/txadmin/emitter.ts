import {
	TX_EVENT_PREFIX,
	type TxEventName,
	type TxEventPayloads,
} from '@fxmanager/shared/types';

/**
 * Emits a backwards compatible txAdmin event across the server for compatability
 */
export function emitTxEvent<E extends TxEventName>(
	event: E,
	data: TxEventPayloads[E],
): void {
	emit(`${TX_EVENT_PREFIX}${event}`, data);
}
