import { repo } from '@fxmanager/database';
import type { PlayerIdentifiers } from '@fxmanager/shared/types';
import { resourceAuth } from '../../middleware/resource';
import type { RouteModule } from '../../types';
import { txAdminCompat } from '../../modules/txadmin/compat';
import {
	buildBannedPayload,
	buildWarnedPayload,
} from '../../modules/txadmin/payloads';
import {
	resolveExpiry,
	resolveIssuer,
	resolveTarget,
	type IngameTarget,
} from './ingame.resolve';

const IDENTIFIER_KEYS: (keyof PlayerIdentifiers)[] = [
	'license',
	'fivem',
	'discord',
	'steam',
];

function pickIdentifiers(
	source: Record<string, unknown>,
): Partial<PlayerIdentifiers> | null {
	const identifiers: Partial<PlayerIdentifiers> = {};
	for (const key of IDENTIFIER_KEYS) {
		const value = source[key];
		if (typeof value === 'string' && value) identifiers[key] = value;
	}
	return Object.keys(identifiers).length > 0 ? identifiers : null;
}

function parseTarget(raw: unknown): IngameTarget | null {
	if (typeof raw === 'number') return raw;
	if (raw && typeof raw === 'object') {
		const t = raw as Record<string, unknown>;
		if (typeof t.serverId === 'number') return { serverId: t.serverId };
		if (typeof t.playerId === 'number') return { playerId: t.playerId };
		if (t.identifiers && typeof t.identifiers === 'object') {
			const identifiers = pickIdentifiers(
				t.identifiers as Record<string, unknown>,
			);
			return identifiers ? { identifiers } : null;
		}
	}
	return null;
}

const parsePage = (v: unknown) =>
	typeof v === 'string' && v ? Number(v) : undefined;

const IngameEndpoints: RouteModule['handler'] = async (fastify, options) => {
	const { gm, pm } = options;

	fastify.addHook('preHandler', resourceAuth);

	const onlineByServerId = (sid: number) =>
		gm.getPlayerList().find((p) => p.serverId === sid);

	const targetDeps = {
		onlineByServerId,
		onlineByPlayerId: (pid: number) => gm.getPlayer(pid),
		playerIdByIdentifiers: (ids: Partial<PlayerIdentifiers>) => {
			for (const [type, value] of Object.entries(ids)) {
				if (!value) continue;
				const found = repo.players.findByIdentifier(
					type as keyof PlayerIdentifiers,
					value,
				);
				if (found) return found.id;
			}
			return null;
		},
	};

	const issuerDeps = {
		onlineByServerId,
		adminByPlayerId: (pid: number) => repo.admins.findByPlayerId(pid),
	};

	fastify.get('/bans', (request) => {
		const q = request.query as { page?: string; pageSize?: string };
		return repo.bans.search({
			page: parsePage(q.page),
			pageSize: parsePage(q.pageSize),
		});
	});

	fastify.get('/bans/search', (request) => {
		const q = request.query as {
			q?: string;
			page?: string;
			pageSize?: string;
		};
		return repo.bans.search({
			query: q.q,
			page: parsePage(q.page),
			pageSize: parsePage(q.pageSize),
		});
	});

	fastify.get('/players', () => gm.getPlayerList());

	fastify.get('/players/search', (request) => {
		const q = request.query as {
			q?: string;
			page?: string;
			pageSize?: string;
			sortBy?: string;
			sortOrder?: string;
		};
		const sortBy = (['playtime', 'lastSeen', 'firstSeen'] as const).find(
			(s) => s === q.sortBy,
		);
		const sortOrder = q.sortOrder === 'asc' ? 'asc' : undefined;
		return repo.players.list(
			parsePage(q.page) ?? 1,
			parsePage(q.pageSize) ?? 50,
			{ search: q.q, sortBy, sortOrder },
		);
	});

	fastify.get('/players/lookup', async (request, reply) => {
		const q = request.query as Record<string, string | undefined>;

		let target: IngameTarget | null = null;
		if (q.serverId) target = { serverId: Number(q.serverId) };
		else if (q.playerId) target = { playerId: Number(q.playerId) };
		else {
			const identifiers = pickIdentifiers(q);
			if (identifiers) target = { identifiers };
		}

		if (!target) return reply.code(400).send({ message: 'invalid_target' });

		const resolved = resolveTarget(target, targetDeps);
		if (!resolved) return reply.code(404).send({ message: 'player_not_found' });

		const profile = await repo.players.findById(resolved.playerId);
		if (!profile) return reply.code(404).send({ message: 'player_not_found' });

		return profile;
	});

	fastify.post('/bans', async (request, reply) => {
		const body = request.body as {
			target?: unknown;
			reason?: string;
			expiresAt?: string | null;
			durationSeconds?: number;
			by?: number;
			resource?: string;
		};

		const target = parseTarget(body.target);
		if (!target) return reply.code(400).send({ message: 'invalid_target' });
		if (!body.reason || typeof body.reason !== 'string')
			return reply.code(400).send({ message: 'reason_required' });

		const resolved = resolveTarget(target, targetDeps);
		if (!resolved) return reply.code(404).send({ message: 'player_not_found' });

		const acting = resolveIssuer(body.by, issuerDeps);
		const issuer = acting?.id ?? null;
		const author = acting?.username ?? 'Ingame API';

		const expiresAt = resolveExpiry(
			{ expiresAt: body.expiresAt, durationSeconds: body.durationSeconds },
			new Date(),
		);

		try {
			const result = await repo.players.addBan(
				resolved.playerId,
				expiresAt,
				body.reason,
				issuer,
			);

			if (result === false)
				return reply.code(409).send({ message: 'active_longer_ban_exists' });

			repo.audit.log({
				adminId: issuer ?? undefined,
				action: 'player.ban',
				playerId: result.player?.id,
				metadata: {
					banId: result.id,
					expiresAt: expiresAt?.toISOString() ?? 'permanent',
					source: 'ingame-api',
					resource: body.resource ?? null,
				},
			});

			const online = resolved.onlinePlayer;
			const expiryDate = expiresAt ? expiresAt.toLocaleString() : 'Permanent';
			const kickMessage = `You have been banned from the server. Reason: ${body.reason}. Expires: ${expiryDate}`;

			if (online) await gm.dropPlayer(online.serverId, kickMessage);

			const profile =
				online ?? (await repo.players.findById(resolved.playerId));
			void txAdminCompat.emit(
				'playerBanned',
				buildBannedPayload({
					author,
					reason: body.reason,
					banId: result.id,
					expiresAt,
					targetNetId: online?.serverId ?? null,
					targetName: profile?.name ?? 'Unknown',
					identifiers: profile?.identifiers,
					kickMessage,
				}),
			);

			return { banId: result.id };
		} catch (err) {
			const error = err as Error;
			if (error.message === 'player_not_found')
				return reply.code(404).send({ message: 'player_not_found' });

			console.error('[ingame-api] ban failed:', error.message);
			return reply.code(500).send({ message: 'internal_error' });
		}
	});

	fastify.post('/bans/:id/revoke', (request, reply) => {
		const { id } = request.params as { id: string };
		const banId = parseInt(id, 10);
		const body = (request.body ?? {}) as { by?: number; resource?: string };

		const revoked = repo.bans.revoke(banId);
		if (!revoked) return reply.code(404).send({ message: 'ban_not_found' });

		const acting = resolveIssuer(body.by, issuerDeps);

		repo.audit.log({
			adminId: acting?.id ?? undefined,
			action: 'player.unban',
			playerId: revoked.playerId,
			metadata: {
				banId,
				source: 'ingame-api',
				resource: body.resource ?? null,
			},
		});

		return { banId };
	});

	fastify.post('/kick', async (request, reply) => {
		const body = request.body as {
			target?: unknown;
			reason?: string;
			by?: number;
			resource?: string;
		};

		const target = parseTarget(body.target);
		if (!target) return reply.code(400).send({ message: 'invalid_target' });
		if (!body.reason || typeof body.reason !== 'string')
			return reply.code(400).send({ message: 'reason_required' });

		const resolved = resolveTarget(target, targetDeps);
		if (!resolved) return reply.code(404).send({ message: 'player_not_found' });

		const online = resolved.onlinePlayer;
		if (!online) return reply.code(409).send({ message: 'not_online' });

		const acting = resolveIssuer(body.by, issuerDeps);
		const issuer = acting?.id ?? null;
		const author = acting?.username ?? 'Ingame API';

		try {
			const result = await repo.players.addKick(
				resolved.playerId,
				body.reason,
				issuer,
			);

			repo.audit.log({
				adminId: issuer ?? undefined,
				action: 'player.kick',
				playerId: result.player?.id,
				metadata: {
					reason: result.reason,
					source: 'ingame-api',
					resource: body.resource ?? null,
				},
			});

			const kickMessage = `You have been kicked from the server. Reason: ${body.reason}`;
			await gm.dropPlayer(online.serverId, kickMessage);

			void txAdminCompat.emit('playerKicked', {
				target: online.serverId,
				author,
				reason: body.reason,
				dropMessage: kickMessage,
			});

			return { kicked: true };
		} catch (err) {
			const error = err as Error;
			console.error('[ingame-api] kick failed:', error.message);
			return reply.code(500).send({ message: 'internal_error' });
		}
	});

	fastify.post('/warn', async (request, reply) => {
		const body = request.body as {
			target?: unknown;
			reason?: string;
			by?: number;
			resource?: string;
		};

		const target = parseTarget(body.target);
		if (!target) return reply.code(400).send({ message: 'invalid_target' });
		if (!body.reason || typeof body.reason !== 'string')
			return reply.code(400).send({ message: 'reason_required' });

		const resolved = resolveTarget(target, targetDeps);
		if (!resolved) return reply.code(404).send({ message: 'player_not_found' });

		const acting = resolveIssuer(body.by, issuerDeps);
		const issuer = acting?.id ?? null;
		const author = acting?.username ?? 'Ingame API';

		try {
			const result = await repo.players.addWarn(
				resolved.playerId,
				body.reason,
				issuer,
			);

			repo.audit.log({
				adminId: issuer ?? undefined,
				action: 'player.warn',
				playerId: result.player?.id,
				metadata: {
					reason: result.reason,
					source: 'ingame-api',
					resource: body.resource ?? null,
				},
			});

			const online = resolved.onlinePlayer;
			const profile =
				online ?? (await repo.players.findById(resolved.playerId));
			void txAdminCompat.emit(
				'playerWarned',
				buildWarnedPayload({
					author,
					reason: body.reason,
					warnId: result.id,
					targetNetId: online?.serverId ?? null,
					targetName: profile?.name ?? 'Unknown',
					identifiers: profile?.identifiers,
				}),
			);

			return { warnId: result.id };
		} catch (err) {
			const error = err as Error;
			if (error.message === 'player_not_found')
				return reply.code(404).send({ message: 'player_not_found' });
			console.error('[ingame-api] warn failed:', error.message);
			return reply.code(500).send({ message: 'internal_error' });
		}
	});

	fastify.post('/notes', async (request, reply) => {
		const body = request.body as {
			target?: unknown;
			content?: string;
			by?: number;
			resource?: string;
		};

		const target = parseTarget(body.target);
		if (!target) return reply.code(400).send({ message: 'invalid_target' });
		if (typeof body.content !== 'string')
			return reply.code(400).send({ message: 'invalid_input' });

		const acting = resolveIssuer(body.by, issuerDeps);
		if (!acting) return reply.code(400).send({ message: 'actor_required' });

		const resolved = resolveTarget(target, targetDeps);
		if (!resolved) return reply.code(404).send({ message: 'player_not_found' });

		try {
			await repo.players.updatePlayerNotes(
				resolved.playerId,
				acting.id,
				body.content,
			);

			repo.audit.log({
				adminId: acting.id,
				action: 'player.note',
				playerId: resolved.playerId,
				metadata: {
					source: 'ingame-api',
					resource: body.resource ?? null,
				},
			});

			return { saved: true };
		} catch (err) {
			const error = err as Error;
			if (error.message === 'player_not_found')
				return reply.code(404).send({ message: 'player_not_found' });
			if (error.message === 'content_too_short')
				return reply.code(400).send({ message: 'content_too_short' });
			console.error('[ingame-api] note failed:', error.message);
			return reply.code(500).send({ message: 'internal_error' });
		}
	});

	fastify.post('/whitelist', (request, reply) => {
		const body = request.body as {
			type?: string;
			value?: string;
			by?: number;
			resource?: string;
		};

		if (!body.type || !body.value)
			return reply.code(400).send({ message: 'invalid_input' });

		const value = body.value.startsWith(`${body.type}:`)
			? body.value
			: `${body.type}:${body.value}`;
		const acting = resolveIssuer(body.by, issuerDeps);

		try {
			repo.whitelist.add({ type: body.type, value, adminId: acting?.id });

			repo.audit.log({
				adminId: acting?.id ?? undefined,
				action: 'whitelist.add',
				metadata: {
					type: body.type,
					value,
					source: 'ingame-api',
					resource: body.resource ?? null,
				},
			});

			return { whitelisted: true };
		} catch (err) {
			return reply.code(400).send({ message: (err as Error).message });
		}
	});

	fastify.post('/whitelist/remove', (request, reply) => {
		const body = request.body as {
			type?: string;
			value?: string;
			by?: number;
			resource?: string;
		};

		if (!body.type || !body.value)
			return reply.code(400).send({ message: 'invalid_input' });

		const value = body.value.startsWith(`${body.type}:`)
			? body.value
			: `${body.type}:${body.value}`;

		const removed = repo.whitelist.revokeByValue(value);
		if (!removed) return reply.code(404).send({ message: 'not_whitelisted' });

		const acting = resolveIssuer(body.by, issuerDeps);
		repo.audit.log({
			adminId: acting?.id ?? undefined,
			action: 'whitelist.revoke',
			metadata: {
				value,
				source: 'ingame-api',
				resource: body.resource ?? null,
			},
		});

		return { removed: true };
	});

	const runServerAction = async (
		body: { by?: number; resource?: string },
		action: 'server.start' | 'server.stop' | 'server.restart',
		run: (author: string) => Promise<boolean>,
	): Promise<boolean> => {
		const acting = resolveIssuer(body.by, issuerDeps);
		const author = acting?.username ?? 'Ingame API';

		const result = await run(author);

		repo.audit.log({
			adminId: acting?.id ?? undefined,
			action,
			metadata: {
				success: result,
				source: 'ingame-api',
				resource: body.resource ?? null,
			},
		});

		return result;
	};

	fastify.post('/server/start', async (request, reply) => {
		const body = (request.body ?? {}) as { by?: number; resource?: string };
		const ok = await runServerAction(body, 'server.start', () => pm.start());
		if (!ok) return reply.code(500).send({ message: 'server_action_failed' });
		return { success: true };
	});

	fastify.post('/server/stop', async (request, reply) => {
		const body = (request.body ?? {}) as { by?: number; resource?: string };
		const ok = await runServerAction(body, 'server.stop', (author) =>
			pm.stop({ author, message: 'Server stopped via the ingame API.' }),
		);
		if (!ok) return reply.code(500).send({ message: 'server_action_failed' });
		return { success: true };
	});

	fastify.post('/server/restart', async (request, reply) => {
		const body = (request.body ?? {}) as { by?: number; resource?: string };
		const ok = await runServerAction(body, 'server.restart', (author) =>
			pm.restart({ author, message: 'Server is restarting (ingame API).' }),
		);
		if (!ok) return reply.code(500).send({ message: 'server_action_failed' });
		return { success: true };
	});
};

export default {
	prefix: '/ingame',
	handler: IngameEndpoints,
} satisfies RouteModule;
