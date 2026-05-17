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
	ApiResponse,
	PaginatedResponse,
	WhitelistEntry,
} from '@fxmanager/shared/types';

const WhitelistEndpoints: RouteModule['handler'] = async (fastify, options) => {
	const { gm, pm } = options;

	// enforces that admin key exists in request otherwise returns 401
	fastify.addHook('preHandler', sessionAuth);

	fastify.get(
		'/',
		async (request): Promise<PaginatedResponse<WhitelistEntry>> => {
			const { admin } = request as AuthedRequest;

			if (
				!PermissionManager.has(admin.permissions, UserPermissions.WHITELIST)
			) {
				throw new Error('Unauthorized');
			}

			const { query } = request as SearchQueryRequest<
				'addedAt' | 'value' | undefined
			>;

			const page = Number(query.page ?? 1);
			const pageSize = Number(query.pageSize ?? 50);

			return await repo.whitelist.list(page, pageSize, {
				search: query.search,
				sortBy: query.sortBy,
				sortOrder: query.sortOrder,
			});
		},
	);

	fastify.post('/add', (request): ApiResponse => {
		const { admin } = request as AuthedRequest;

		if (!PermissionManager.has(admin.permissions, UserPermissions.WHITELIST)) {
			throw new Error('Unauthorized');
		}

		const body = request.body as { type: string; value: string };

		const value = body.value.startsWith(`${body.type}:`)
			? body.value
			: `${body.type}:${body.value}`;

		try {
			repo.whitelist.add({
				type: body.type,
				value,
				adminId: admin.id,
			});

			return {
				success: true,
				data: undefined,
			};
		} catch (err) {
			const msg = (err as Error).message;

			if (msg === 'already_whitelisted') {
				return {
					success: false,
					error: 'Identifier is already whitelisted',
				};
			} else if (msg === 'unsupported_type') {
				return {
					success: false,
					error: 'Provided type is unsupported',
				};
			} else if (msg === 'invalid_format') {
				return {
					success: false,
					error: `Identifier does not follow the format for ${body.type}.`,
				};
			} else {
				console.error('/api/whitelist/add failed:', err);
				return {
					success: false,
					error: 'An error occured',
				};
			}
		}
	});

	fastify.post('/revoke', (request): ApiResponse => {
		const { admin } = request as AuthedRequest;

		if (
			!PermissionManager.has(
				admin.permissions,
				UserPermissions.REVOKE_WHITELIST,
			)
		) {
			throw new Error('Unauthorized');
		}

		const { id } = request.body as { id: number };

		const whitelistData = repo.whitelist.revoke(id);

		if (!whitelistData) {
			return {
				success: false,
				error: 'No whitelist entry found',
			};
		}

		const { items: players } = repo.players.list(1, 5, {
			search: whitelistData.value,
		});

		if (players.length === 0) {
			return {
				success: true,
				data: undefined,
			};
		}

		if (pm.getState().status === 'running') {
			for (const player of players) {
				const serverPlayer = gm.getPlayerList().find((p) => p.id === player.id);

				if (serverPlayer) {
					gm.dropPlayer(serverPlayer.serverId, 'Whitelist was revoked');
				}
			}
		}

		return {
			success: true,
			data: undefined,
		};
	});
};

export default {
	prefix: '/whitelist',
	handler: WhitelistEndpoints,
} satisfies RouteModule;
