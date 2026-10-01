import { ACE_PREFIX } from '@fxmanager/shared/constants';
import type { PlayerIdentifiers } from '@fxmanager/shared/types';
import { slugifyGroupName } from '@fxmanager/shared/utils';
import { QueryManager } from './utils/query';

type Target =
	| number
	| { serverId: number }
	| { playerId: number }
	| { identifiers: Partial<PlayerIdentifiers> };

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
type PageOpts = { page?: number; pageSize?: number };

async function call<T>(
	endpoint: string,
	method: 'GET' | 'POST',
	body?: unknown,
): Promise<Result<T>> {
	try {
		const data = await QueryManager<T>({ endpoint, method, body });
		return { ok: true, data };
	} catch (err) {
		return { ok: false, error: (err as Error).message };
	}
}

const get = <T>(endpoint: string) => call<T>(endpoint, 'GET');

const post = <T>(endpoint: string, input: object) =>
	call<T>(endpoint, 'POST', { ...input, resource: GetInvokingResource() });

function qs(params: URLSearchParams): string {
	const query = params.toString();
	return query ? `?${query}` : '';
}

function pageParams(opts?: PageOpts): URLSearchParams {
	const params = new URLSearchParams();
	if (opts?.page) params.set('page', String(opts.page));
	if (opts?.pageSize) params.set('pageSize', String(opts.pageSize));
	return params;
}

function lookupQuery(target: Target): string {
	const params = new URLSearchParams();
	if (typeof target === 'number') params.set('serverId', String(target));
	else if ('serverId' in target)
		params.set('serverId', String(target.serverId));
	else if ('playerId' in target)
		params.set('playerId', String(target.playerId));
	else
		for (const [type, value] of Object.entries(target.identifiers))
			if (value) params.set(type, value);
	return params.toString();
}

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

exports('hasGroup', (playerId: number | string, groupName: string): boolean => {
	const slug = slugifyGroupName(groupName);
	if (!slug) return false;

	return IsPlayerAceAllowed(String(playerId), `${ACE_PREFIX}.group.${slug}`);
});

type SelfInfo = {
	isAdmin: boolean;
	isMaster: boolean;
	adminId: number | null;
	username: string | null;
	group: {
		id: number;
		name: string;
		colour: string;
		icon: string | null;
	} | null;
	permissions: string[];
};

exports('getSelf', (playerId: number | string) =>
	get<SelfInfo>(`/ingame/self?serverId=${Number(playerId)}`),
);

exports('fetchPlayers', () => get('/ingame/players'));

exports('getPlayer', (target: Target) =>
	get(`/ingame/players/lookup?${lookupQuery(target)}`),
);

exports(
	'searchPlayers',
	(
		query: string,
		opts?: PageOpts & {
			sortBy?: 'playtime' | 'lastSeen' | 'firstSeen';
			sortOrder?: 'asc' | 'desc';
		},
	) => {
		const params = pageParams(opts);
		if (query) params.set('q', query);
		if (opts?.sortBy) params.set('sortBy', opts.sortBy);
		if (opts?.sortOrder) params.set('sortOrder', opts.sortOrder);
		return get(`/ingame/players/search${qs(params)}`);
	},
);

exports('recentBans', (opts?: PageOpts) =>
	get(`/ingame/bans${qs(pageParams(opts))}`),
);

exports('searchBans', (query: string, opts?: PageOpts) => {
	const params = pageParams(opts);
	if (query) params.set('q', query);
	return get(`/ingame/bans/search${qs(params)}`);
});

exports(
	'ban',
	(input: {
		target: Target;
		reason: string;
		expiresAt?: string | null;
		durationSeconds?: number;
		by?: number;
	}) => post('/ingame/bans', input),
);

exports('revokeBan', (banId: number, opts?: { by?: number }) =>
	post(`/ingame/bans/${banId}/revoke`, opts ?? {}),
);

exports('revokeWarn', (warnId: number, opts?: { by?: number }) =>
	post(`/ingame/warns/${warnId}/revoke`, opts ?? {}),
);

exports('revokeKick', (kickId: number, opts?: { by?: number }) =>
	post(`/ingame/kicks/${kickId}/revoke`, opts ?? {}),
);

exports('kick', (input: { target: Target; reason: string; by?: number }) =>
	post('/ingame/kick', input),
);

exports(
	'warnPlayer',
	(input: { target: Target; reason: string; by?: number }) =>
		post('/ingame/warn', input),
);

exports('addNote', (input: { target: Target; content: string; by: number }) =>
	post('/ingame/notes', input),
);

exports(
	'actionRecap',
	(input: {
		serverId: number;
		label: string;
		target?: Target;
		metadata?: Record<string, unknown>;
	}) => post('/ingame/recap', input),
);

exports(
	'getActionRecap',
	(opts: PageOpts & { adminId?: number; serverId?: number }) => {
		const params = pageParams(opts);
		if (opts.adminId !== undefined) params.set('adminId', String(opts.adminId));
		if (opts.serverId !== undefined)
			params.set('serverId', String(opts.serverId));
		return get(`/ingame/recap${qs(params)}`);
	},
);

exports('whitelistAdd', (input: { type: string; value: string; by?: number }) =>
	post('/ingame/whitelist', input),
);

exports(
	'whitelistRemove',
	(input: { type: string; value: string; by?: number }) =>
		post('/ingame/whitelist/remove', input),
);

exports('serverStop', (by?: number) => post('/ingame/server/stop', { by }));

exports('serverRestart', (by?: number) =>
	post('/ingame/server/restart', { by }),
);
