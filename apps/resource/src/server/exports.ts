import { ACE_PREFIX } from '@fxmanager/shared/constants';

// usage from any resource:
//   exports.fxManager.hasPermission(source, 'players.kick')
// keys are defined in PERMISSION_ACE_KEYS; permissions are registered as aces
// by the fxManager core, so plain IsPlayerAceAllowed also works.
exports(
	'hasPermission',
	(playerId: number | string, permissionKey: string): boolean => {
		if (typeof permissionKey !== 'string' || permissionKey.length === 0)
			return false;

		return IsPlayerAceAllowed(
			String(playerId),
			`${ACE_PREFIX}.${permissionKey}`,
		);
	},
);
