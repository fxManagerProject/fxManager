import { repo } from '@fxmanager/database';
import type { RevokeActionType } from '@fxmanager/shared/types';
import { txAdminCompat } from './compat';
import { buildActionRevokedPayload } from './payloads';

export async function emitActionRevoked(args: {
	actionId: number;
	actionType: RevokeActionType;
	actionReason: string | null;
	issuer: number | null;
	playerId: number;
	revokedBy: string;
}): Promise<void> {
	try {
		const profile = await repo.players.findById(args.playerId);
		const actionAuthor =
			args.issuer != null
				? (repo.admins.findById(args.issuer)?.username ?? '')
				: '';

		void txAdminCompat.emit(
			'actionRevoked',
			buildActionRevokedPayload({
				actionId: args.actionId,
				actionType: args.actionType,
				actionReason: args.actionReason,
				actionAuthor,
				playerName: profile?.name ?? null,
				identifiers: profile?.identifiers,
				revokedBy: args.revokedBy,
			}),
		);
	} catch (err) {
		console.error(
			'[actionRevoked] failed to build/relay event:',
			(err as Error).message,
		);
	}
}
