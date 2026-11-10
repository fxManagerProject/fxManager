import z from 'zod';
import { API_TOKEN } from '../utils/env';
import { HttpServer } from './class';
import { getResourcesData } from '../utils/resources';
import { handleTxEvent, txEventSchema } from '../txadmin/handler';

const api = new HttpServer(API_TOKEN);

api.post(
	'/drop',
	{
		schema: z.object({
			serverId: z.number(),
			reason: z.string(),
			license: z.string().optional(),
		}),
	},
	({ body }) => {
		const { serverId, reason, license } = body;
		if (
			license &&
			GetPlayerIdentifierByType(String(serverId), 'license') !== license
		) {
			return {
				status: 409,
				body: { success: false, error: 'Player connection changed' },
			};
		}

		DropPlayer(String(serverId), reason);

		return {
			status: 200,
			body: { success: true, data: null },
		};
	},
);

api.get('/resources/load', () => {
	return {
		status: 200,
		body: { success: true, data: getResourcesData() },
	};
});

api.get('/server/version', () => {
	return {
		status: 200,
		body: { success: true, data: GetConvar('version', 'unknown') },
	};
});

api.post('/txadmin/event', { schema: txEventSchema }, ({ body }) =>
	handleTxEvent(body),
);
