import type {
	AuthedRequest,
	RouteModule,
	SearchQueryRequest,
} from '../../types';
import { sessionAuth } from '../../middleware/session';
import { PermissionManager } from '@fxmanager/shared/utils';
import { UserPermissions } from '@fxmanager/shared/constants';
import { repo } from '@fxmanager/database';
import type {
	PaginatedResponse,
	Player,
	PlayerSession,
} from '@fxmanager/shared/types';
import { txAdminCompat } from '../../modules/txadmin/compat';
import {
	buildBannedPayload,
	buildWarnedPayload,
} from '../../modules/txadmin/payloads';
import { emitActionRevoked } from '../../modules/txadmin/revoke';

const startOfDay = (d: Date) =>
	new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) =>
	new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const endOfToday = () => {
	const d = new Date();
	return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
};

const PlayerEndpoints: RouteModule['handler'] = async (fastify, options) => {
	const { gm } = options;

	// enforces that admin key exists in request otherwise returns 401
	fastify.addHook('preHandler', sessionAuth);

	fastify.get(
		'/',
		(request): PaginatedResponse<Omit<Player, 'identifiers'>> => {
			const { query } = request as SearchQueryRequest<
				'playtime' | 'firstSeen' | 'lastSeen' | undefined
			>;

			const page = Number(query.page ?? 1);
			const pageSize = Number(query.pageSize ?? 50);

			return repo.players.list(page, pageSize, {
				search: query.search,
				sortBy: query.sortBy,
				sortOrder: query.sortOrder,
			});
		},
	);

	fastify.get('/:playerId', async (request) => {
		const { playerId: playerIdRaw } = request.params as { playerId: string };
		const playerId = parseInt(playerIdRaw, 10);

		const profile = await repo.players.findById(playerId);

		if (!profile)
			return {
				success: false,
				error: `Player id ${playerId} does not exist.`,
			};

		return { success: true, data: profile };
	});

	fastify.get('/:playerId/activity', (request) => {
		const { playerId: raw } = request.params as { playerId: string };
		const playerId = parseInt(raw, 10);
		const { from, to } = (request.query ?? {}) as {
			from?: string;
			to?: string;
		};

		const toDate = to ? new Date(`${to}T23:59:59.999`) : endOfToday();
		const fromDate = from
			? new Date(`${from}T00:00:00.000`)
			: startOfDay(addDays(toDate, -29));

		const data = repo.playerSessions.getRangeActivity(
			playerId,
			fromDate,
			toDate,
		);
		return { success: true, data };
	});

	fastify.get(
		'/:playerId/sessions',
		(request): PaginatedResponse<PlayerSession> => {
			const { playerId: raw } = request.params as { playerId: string };
			const playerId = parseInt(raw, 10);
			const { page, pageSize } = (request.query ?? {}) as {
				page?: string;
				pageSize?: string;
			};
			return repo.playerSessions.listSessions(
				playerId,
				Number(page ?? 1),
				Number(pageSize ?? 25),
			);
		},
	);

	fastify.post('/:playerId/notes', async (request, reply) => {
		const { playerId: playerIdRaw } = request.params as { playerId: string };
		const { content } = request.body as { content: string };
		const { admin } = request as AuthedRequest;

		const playerId = parseInt(playerIdRaw, 10);

		try {
			const result = await repo.players.updatePlayerNotes(
				playerId,
				admin.id,
				content,
			);

			repo.audit.log({
				adminId: admin.id,
				action: 'player.note',
				playerId: result.player?.id,
				metadata: {
					note: result.content ?? 'Note deleted',
				},
			});

			return { success: true, data: null };
		} catch (err) {
			const error = err as Error;

			if (error.message === 'content_too_short')
				return {
					success: false,
					error: 'Content is too short',
				};

			console.error('An error occurred when updating a player notes', {
				playerId,
				adminId: admin.id,
				content,
			});

			return reply.code(500).send({
				success: false,
				error: error.message,
			});
		}
	});

	fastify.post('/:playerId/ban', async (request, reply) => {
		const { playerId: playerIdRaw } = request.params as { playerId: string };
		const { reason, expiresAt: expiresAtRaw } = request.body as {
			reason: string;
			expiresAt: string | null;
		};
		const { admin } = request as AuthedRequest;
		const playerId = parseInt(playerIdRaw, 10);

		if (!PermissionManager.has(admin.permissions, UserPermissions.BAN)) {
			return {
				success: false,
				error: 'Not authorized',
			};
		}

		const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

		try {
			const result = await repo.players.addBan(
				playerId,
				expiresAt ? new Date(expiresAt) : null,
				reason,
				admin.id,
			);

			if (result === false) {
				return {
					success: false,
					error: 'Player is already under an active, longer ban',
				};
			}

			repo.audit.log({
				adminId: admin.id,
				action: 'player.ban',
				playerId: result.player?.id,
				metadata: {
					banId: result.id,
					expiresAt: expiresAt?.toISOString() ?? 'permanent',
				},
			});

			const onlinePlayer = gm.getPlayer(playerId);
			const expiryDate = expiresAt
				? new Date(expiresAt).toLocaleString()
				: 'Permanent';

			const kickMessage = `You have been banned from the server. Reason: ${reason}. Expires: ${expiryDate}`;

			if (onlinePlayer) {
				await gm.dropPlayer(onlinePlayer.serverId, kickMessage);
			}

			const profile = onlinePlayer ?? (await repo.players.findById(playerId));
			void txAdminCompat.emit(
				'playerBanned',
				buildBannedPayload({
					author: admin.username,
					reason,
					banId: result.id,
					expiresAt,
					targetNetId: onlinePlayer?.serverId ?? null,
					targetName: profile?.name ?? 'Unknown',
					identifiers: profile?.identifiers,
					kickMessage,
				}),
			);

			return {
				success: true,
				data: null,
			};
		} catch (err) {
			const error = err as Error;

			if (error.message === 'player_not_found') {
				return reply.code(404).send({
					success: false,
					error: 'The requested player could not be found',
				});
			}

			console.error('An error occurred when adding a ban to player:', {
				message: error.message,
				playerId,
				admin: admin.username,
				body: request.body,
			});

			return reply.code(500).send({
				success: false,
				error: 'An internal server error occurred while archiving the ban',
			});
		}
	});

	fastify.post('/:playerId/kick', async (request, reply) => {
		const { playerId: playerIdRaw } = request.params as { playerId: string };
		const { reason } = request.body as { reason: string };
		const { admin } = request as AuthedRequest;
		const playerId = parseInt(playerIdRaw, 10);

		if (!PermissionManager.has(admin.permissions, UserPermissions.KICK)) {
			return {
				success: false,
				error: 'Not authorized',
			};
		}

		const onlinePlayer = gm.getPlayer(playerId);
		if (!onlinePlayer) {
			return {
				success: false,
				error: 'Player is not online',
			};
		}

		try {
			const result = await repo.players.addKick(playerId, reason, admin.id);

			repo.audit.log({
				adminId: admin.id,
				action: 'player.kick',
				playerId: result.player?.id,
				metadata: {
					reason: result.reason,
				},
			});

			const kickMessage = `You have been kicked from the server. Reason: ${reason}`;
			await gm.dropPlayer(onlinePlayer.serverId, kickMessage);

			void txAdminCompat.emit('playerKicked', {
				target: onlinePlayer.serverId,
				author: admin.username,
				reason,
				dropMessage: kickMessage,
			});

			return {
				success: true,
				data: null,
			};
		} catch (err) {
			const error = err as Error;

			console.error('An error occurred when kicking a player', error.message, {
				playerId,
				admin,
				body: request.body,
			});

			return reply.code(500).send({
				success: false,
				error: error.message,
			});
		}
	});

	fastify.post('/:playerId/warn', async (request, reply) => {
		const { playerId: playerIdRaw } = request.params as { playerId: string };
		const { reason } = request.body as { reason: string };
		const { admin } = request as AuthedRequest;
		const playerId = parseInt(playerIdRaw, 10);

		if (!PermissionManager.has(admin.permissions, UserPermissions.WARN)) {
			return reply.code(403).send({
				success: false,
				error: 'Not authorized',
			});
		}

		try {
			const result = await repo.players.addWarn(playerId, reason, admin.id);

			repo.audit.log({
				adminId: admin.id,
				action: 'player.warn',
				playerId: result.player?.id,
				metadata: {
					reason: result.reason,
				},
			});

			// ToDo: warn player in game
			// - needs to be able to be done offline so on connection he receives it

			const onlinePlayer = gm.getPlayer(playerId);
			const profile = onlinePlayer ?? (await repo.players.findById(playerId));
			void txAdminCompat.emit(
				'playerWarned',
				buildWarnedPayload({
					author: admin.username,
					reason,
					warnId: result.id,
					targetNetId: onlinePlayer?.serverId ?? null,
					targetName: profile?.name ?? 'Unknown',
					identifiers: profile?.identifiers,
				}),
			);

			return {
				success: true,
				data: null,
			};
		} catch (err) {
			const error = err as Error;

			console.error('An error occurred when warning a player', error.message, {
				playerId,
				admin,
				body: request.body,
			});

			return reply.code(500).send({
				success: false,
				error: error.message,
			});
		}
	});

	const REVOKE_ACTIONS = {
		ban: {
			permission: UserPermissions.REVOKE_BAN,
			audit: 'player.unban',
			revoke: (id: number, pid: number) => repo.bans.revoke(id, pid),
		},
		kick: {
			permission: UserPermissions.REVOKE_KICK,
			audit: 'player.unkick',
			revoke: (id: number, pid: number) => repo.players.revokeKick(id, pid),
		},
		warn: {
			permission: UserPermissions.REVOKE_WARN,
			audit: 'player.unwarn',
			revoke: (id: number, pid: number) => repo.players.revokeWarn(id, pid),
		},
	} as const;

	fastify.post('/:playerId/revoke', async (request, reply) => {
		const { playerId: playerIdRaw } = request.params as { playerId: string };
		const { type, id } = request.body as {
			type?: string;
			id?: number;
		};
		const { admin } = request as AuthedRequest;
		const playerId = parseInt(playerIdRaw, 10);

		if (type !== 'ban' && type !== 'kick' && type !== 'warn') {
			return reply.code(400).send({
				success: false,
				error: 'Invalid action type',
			});
		}

		if (typeof id !== 'number' || !Number.isInteger(id)) {
			return reply.code(400).send({
				success: false,
				error: 'Invalid action id',
			});
		}

		const revokeAction = REVOKE_ACTIONS[type];

		if (!PermissionManager.has(admin.permissions, revokeAction.permission)) {
			return reply.code(403).send({
				success: false,
				error: 'Not authorized',
			});
		}

		try {
			const revoked = revokeAction.revoke(id, playerId);

			if (!revoked) {
				return reply.code(404).send({
					success: false,
					error: 'Action not found or already revoked',
				});
			}

			repo.audit.log({
				adminId: admin.id,
				action: revokeAction.audit,
				playerId: revoked.playerId,
				metadata: { [`${type}Id`]: id },
			});

			await emitActionRevoked({
				actionId: id,
				actionType: type,
				actionReason: revoked.reason ?? null,
				issuer: revoked.issuer,
				playerId: revoked.playerId,
				revokedBy: admin.username,
			});

			return { success: true, data: null };
		} catch (err) {
			const error = err as Error;

			console.error('An error occurred when revoking a player action', {
				message: error.message,
				playerId,
				type,
				id,
				admin: admin.username,
			});

			return reply.code(500).send({
				success: false,
				error: 'An internal server error occurred while revoking the action',
			});
		}
	});
};

export default {
	prefix: '/players',
	handler: PlayerEndpoints,
} satisfies RouteModule;
