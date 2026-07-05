import { repo } from '@fxmanager/database';
import { ANTICHEAT_CONVARS, UserPermissions } from '@fxmanager/shared/constants';
import type {
	AnticheatOverrides,
	ApiResponse,
	ConvarPoolConfig,
	PoolSizeLimits,
	PoolSizeOverrides,
} from '@fxmanager/shared/types';
import { PermissionManager } from '@fxmanager/shared/utils';
import { sessionAuth } from '../../middleware/session';
import {
	parseAnticheatOverrides,
	validateAnticheatOverrides,
} from '../../modules/convars/anticheat';
import { poolLimits } from '../../modules/convars/pool-limits';
import { parsePoolSizes, validatePoolSizes } from '../../modules/convars/pool-sizes';
import {
	getStoredAnticheatOverrides,
	getStoredPoolConfig,
	isConvarGameType,
	setStoredAnticheatOverrides,
	setStoredPoolConfig,
} from '../../modules/convars/store';
import type { AuthedRequest, RouteModule } from '../../types';

interface SavePoolSizesResult extends ConvarPoolConfig {
	warnings: string[];
}

interface SaveAnticheatResult {
	overrides: AnticheatOverrides;
	warnings: string[];
}

const ConvarsEndpoints: RouteModule['handler'] = async (fastify) => {
	fastify.addHook('preHandler', sessionAuth);

	const canAccess = (perms: number) =>
		PermissionManager.has(perms, UserPermissions.SETTINGS_ACCESS);

	// Live pool names + maximum increases, always fetched from cfx.re.
	fastify.get('/pool-limits', async (request, reply) => {
		const { admin } = request as AuthedRequest;
		if (!canAccess(admin.permissions)) {
			return reply.code(403).send({ success: false, error: 'Not authorized' });
		}

		const game = (request.query as { game?: string }).game;
		if (!isConvarGameType(game)) {
			return reply
				.code(400)
				.send({ success: false, error: 'Invalid or missing game type' });
		}

		try {
			const limits = await poolLimits.getLimits(game, { forceRefresh: true });
			return reply.send({
				success: true,
				data: limits,
			} satisfies ApiResponse<PoolSizeLimits>);
		} catch (err) {
			return reply.code(502).send({
				success: false,
				error: `Failed to fetch pool size limits: ${(err as Error).message}`,
			});
		}
	});

	fastify.get('/pool-sizes', async (request, reply) => {
		const { admin } = request as AuthedRequest;
		if (!canAccess(admin.permissions)) {
			return reply.code(403).send({ success: false, error: 'Not authorized' });
		}

		return reply.send({
			success: true,
			data: getStoredPoolConfig(),
		} satisfies ApiResponse<ConvarPoolConfig>);
	});

	fastify.post('/pool-sizes', async (request, reply) => {
		const { admin } = request as AuthedRequest;
		if (!canAccess(admin.permissions)) {
			return reply.code(403).send({ success: false, error: 'Not authorized' });
		}

		const body = request.body as { gameType?: unknown; poolSizes?: unknown };
		if (!isConvarGameType(body.gameType)) {
			return reply.code(400).send({ success: false, error: 'Invalid game type' });
		}

		const overrides: PoolSizeOverrides = parsePoolSizes(
			typeof body.poolSizes === 'string'
				? body.poolSizes
				: JSON.stringify(body.poolSizes ?? {}),
		);

		let limits: PoolSizeLimits;
		try {
			limits = await poolLimits.getLimits(body.gameType, { forceRefresh: true });
		} catch (err) {
			return reply.code(502).send({
				success: false,
				error: `Could not validate against pool size limits: ${(err as Error).message}`,
			});
		}

		const { valid, warnings } = validatePoolSizes(overrides, limits);
		setStoredPoolConfig(body.gameType, valid);

		repo.audit.log({
			adminId: admin.id,
			action: 'settings.update',
			metadata: {
				key: 'convars.poolSizes',
				gameType: body.gameType,
				pools: Object.keys(valid).length,
			},
		});

		return reply.send({
			success: true,
			data: { gameType: body.gameType, poolSizes: valid, warnings },
		} satisfies ApiResponse<SavePoolSizesResult>);
	});

	fastify.get('/anticheat', async (request, reply) => {
		const { admin } = request as AuthedRequest;
		if (!canAccess(admin.permissions)) {
			return reply.code(403).send({ success: false, error: 'Not authorized' });
		}

		return reply.send({
			success: true,
			data: getStoredAnticheatOverrides(),
		} satisfies ApiResponse<AnticheatOverrides>);
	});

	fastify.post('/anticheat', async (request, reply) => {
		const { admin } = request as AuthedRequest;
		if (!canAccess(admin.permissions)) {
			return reply.code(403).send({ success: false, error: 'Not authorized' });
		}

		const body = request.body as { overrides?: unknown };
		const overrides: AnticheatOverrides = parseAnticheatOverrides(
			typeof body.overrides === 'string'
				? body.overrides
				: JSON.stringify(body.overrides ?? {}),
		);

		const { valid, warnings } = validateAnticheatOverrides(
			overrides,
			ANTICHEAT_CONVARS,
		);
		setStoredAnticheatOverrides(valid);

		repo.audit.log({
			adminId: admin.id,
			action: 'settings.update',
			metadata: {
				key: 'convars.anticheat',
				convars: Object.keys(valid).length,
			},
		});

		return reply.send({
			success: true,
			data: { overrides: valid, warnings },
		} satisfies ApiResponse<SaveAnticheatResult>);
	});
};

export default {
	prefix: '/convars',
	handler: ConvarsEndpoints,
} satisfies RouteModule;
