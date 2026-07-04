import type {
	PlayerIdentifiers,
	TxEventPayloads,
} from '@fxmanager/shared/types';

export function identifiersToTxIds(
	identifiers?: Partial<PlayerIdentifiers>,
): string[] {
	if (!identifiers) return [];
	return Object.values(identifiers).filter(
		(value): value is string => typeof value === 'string' && value.length > 0,
	);
}

function toActionId(id: number | undefined): string {
	return id === undefined ? '' : String(id);
}

export function buildBannedPayload(args: {
	author: string;
	reason: string;
	banId: number | undefined;
	expiresAt: Date | null;
	targetNetId: number | null;
	targetName: string;
	identifiers?: Partial<PlayerIdentifiers>;
	kickMessage: string;
}): TxEventPayloads['playerBanned'] {
	return {
		author: args.author,
		reason: args.reason,
		actionId: toActionId(args.banId),
		expiration: args.expiresAt
			? Math.floor(args.expiresAt.getTime() / 1000)
			: false,
		durationInput: '',
		durationTranslated: null,
		targetNetId: args.targetNetId,
		targetIds: identifiersToTxIds(args.identifiers),
		targetHwids: [],
		targetName: args.targetName,
		kickMessage: args.kickMessage,
	};
}

export function buildActionRevokedPayload(args: {
	actionId: number | undefined;
	actionType: string;
	actionReason: string | null;
	actionAuthor: string;
	playerName: string | null;
	identifiers?: Partial<PlayerIdentifiers>;
	revokedBy: string;
}): TxEventPayloads['actionRevoked'] {
	return {
		actionId: toActionId(args.actionId),
		actionType: args.actionType,
		actionReason: args.actionReason ?? '',
		actionAuthor: args.actionAuthor,
		playerName: args.playerName ?? false,
		playerIds: identifiersToTxIds(args.identifiers),
		playerHwids: [],
		revokedBy: args.revokedBy,
	};
}

export function buildWarnedPayload(args: {
	author: string;
	reason: string;
	warnId: number | undefined;
	targetNetId: number | null;
	targetName: string;
	identifiers?: Partial<PlayerIdentifiers>;
}): TxEventPayloads['playerWarned'] {
	return {
		author: args.author,
		reason: args.reason,
		actionId: toActionId(args.warnId),
		targetNetId: args.targetNetId,
		targetIds: identifiersToTxIds(args.identifiers),
		targetName: args.targetName,
	};
}
