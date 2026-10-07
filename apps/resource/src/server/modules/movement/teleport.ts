// src/server/modules/noclip.ts
import { CALLBACK_NAMES } from '@common/types';
import { ServerCallbacks } from '../../utils/callbacks';

ServerCallbacks.register<null, boolean>(
	CALLBACK_NAMES.TELEPORT_COORDS,
	async (_source: number) => {
		return true;
	},
	{
		permission: 'TELEPORT',
		fallback: false,
	},
);
