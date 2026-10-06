// src/server/modules/noclip.ts
import { CALLBACK_NAMES } from '@common/types';
import { ServerCallbacks } from '../../utils/callbacks';

interface NoclipTogglePayload {
	state: boolean;
}

interface NoclipToggleResponse {
	allowed: boolean;
	state: boolean;
	reason?: string;
}

ServerCallbacks.register<NoclipTogglePayload, NoclipToggleResponse>(
	CALLBACK_NAMES.TOGGLE_NOCLIP,
	async (_source: number, payload: NoclipTogglePayload) => {
		return {
			allowed: true,
			state: payload.state,
		};
	},
	{
		permission: 'NOCLIP',
		fallback: {
			allowed: false,
			state: false,
			reason: 'You do not have permission to use No-Clip.',
		},
	},
);
