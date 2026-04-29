import type {
	AuthedRequest,
	RouteModule,
	SearchQueryRequest,
} from '../../types';
import { sessionAuth } from '../../middleware/session';
import { PermissionManager } from '@fxmanager/shared/utils';
import { UserPermissions } from '@fxmanager/shared/constants';
import { repo } from '@fxmanager/database';
import type { PaginatedResponse, Player } from '@fxmanager/shared/types';

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

	fastify.post('/:playerId/notes', async (request, reply) => {
		const { playerId: playerIdRaw } = request.params as { playerId: string };
		const { content } = request.body as { content: string };
		const { admin } = request as AuthedRequest;

		const playerId = parseInt(playerIdRaw, 10);

		try {
			await repo.players.updatePlayerNotes(playerId, admin.id, content);
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
		const { reason, expiresAt } = request.body as {
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

		try {
			const result = await repo.players.addBan(
				playerId,
				expiresAt ? new Date(expiresAt) : null,
				reason,
				admin.id,
			);

			const onlinePlayer = gm.getPlayer(playerId);
			if (onlinePlayer) {
				const expiryDate = expiresAt
					? new Date(expiresAt).toLocaleString()
					: 'Permanent';

				// apparently drop modal in fivem/redm doesn't support new lines ?
				const kickMessage = `You have been banned from the server. Reason: ${reason}. Expires: ${expiryDate}`;

				await gm.dropPlayer(onlinePlayer.serverId, kickMessage);
			}

			if (result) {
				return {
					success: true,
					data: null,
				};
			} else {
				return {
					success: false,
					error: 'Player is already banned',
				};
			}
		} catch (err) {
			const error = err as Error;
			console.error(
				'An error occurred when adding a ban to player',
				error.message,
				{
					playerId,
					admin: admin.username,
					body: request.body,
				},
			);

			return reply.code(500).send({
				success: false,
				error: error.message,
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
			await repo.players.addKick(playerId, reason, admin.id);

			const kickMessage = `You have been kicked from the server. Reason: ${reason}`;
			await gm.dropPlayer(onlinePlayer.serverId, kickMessage);

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
			await repo.players.addWarn(playerId, reason, admin.id);

			// ToDo: warn player in game
			// - needs to be able to be done offline so on connection he receives it
			// await gm.warnPlayer(playerId, reason)

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
};

export default {
	prefix: '/players',
	handler: PlayerEndpoints,
} satisfies RouteModule;
