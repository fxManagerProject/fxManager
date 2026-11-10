import { CALLBACK_NAMES } from '@common/types';
import { ClientCallbacks } from '../../utils/callbacks';
import { NuiCallback } from '../../utils/nui-callbacks';

NuiCallback<Record<string, unknown>, unknown>(
	'get-players',
	async (payload, reply) =>
		reply(
			await ClientCallbacks.trigger(CALLBACK_NAMES.LIST_PLAYERS, payload, {
				fallback: null,
			}),
		),
);
NuiCallback('player-action', async (payload, reply) =>
	reply(
		await ClientCallbacks.trigger(CALLBACK_NAMES.PLAYER_ACTION, payload, {
			fallback: {
				success: false,
				message: 'Action refused or server unavailable.',
			},
			timeoutMs: 15000,
		}),
	),
);
