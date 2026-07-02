import { ACE_PREFIX } from '@fxmanager/shared/constants';

RegisterCommand(
	'hasperm',
	(source: number, args: string[]) => {
		const key = args[0];
		const target = args[1] ? Number(args[1]) : source;

		if (!key) {
			console.log('[fxManager] usage: hasperm <permission.key> [serverId]');
			return;
		}

		if (!target || Number.isNaN(target)) {
			console.log(
				'[fxManager] run this in-game, or pass a connected player id: hasperm <permission.key> <serverId>',
			);
			return;
		}

		const name = GetPlayerName(String(target));
		if (!name) {
			console.log(`[fxManager] no connected player with server id ${target}`);
			return;
		}

		const ace = `${ACE_PREFIX}.${key}`;
		const allowed = IsPlayerAceAllowed(String(target), ace);
		const verdict = allowed ? 'ALLOWED' : 'DENIED';

		console.log(`[fxManager] ${name} (${target}) -> ${ace}: ${verdict}`);

		if (source > 0) {
			emitNet('chat:addMessage', source, {
				color: allowed ? [0, 200, 0] : [200, 60, 60],
				args: ['fxManager', `${ace}: ${verdict}`],
			});
		}
	},
	false,
);
