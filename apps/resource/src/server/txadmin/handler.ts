import { TX_EVENT_NAMES, type TxEventPayloads } from '@fxmanager/shared/types';
import { z } from 'zod';
import type { HttpResponse } from '../types';
import { emitTxEvent } from './emitter';

export const txEventSchema = z.object({
	event: z.enum(TX_EVENT_NAMES),
	data: z.unknown(),
});

export type TxEventRequest = z.infer<typeof txEventSchema>;

export function handleTxEvent(body: TxEventRequest): HttpResponse {
	emitTxEvent(body.event, body.data as TxEventPayloads[typeof body.event]);

	return {
		status: 200,
		body: { success: true, data: null },
	};
}
