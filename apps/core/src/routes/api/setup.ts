import path from 'node:path';
import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { repo } from '@fxmanager/database';
import { UserPermissions } from '@fxmanager/shared/constants';
import type { ApiResponse } from '@fxmanager/shared/types';
import { COOKIE_NAME, fileExists, isFxManagerSetup } from '../../common/utils';
import { ConfigManager } from '../../modules/config/manager';
import { setupTokenManager } from '../../modules/setup/token';
import type { RouteModule } from '../../types';

interface DetectResult {
	executable: string;
	dataPath: string;
	cfgPath: string;
	found: { executable: boolean; dataPath: boolean; cfg: boolean };
}

const AdminGroupSchema = Type.Object({
	name: Type.String(),
	permissions: Type.Number(),
	colour: Type.Optional(Type.String()),
	icon: Type.Optional(Type.String()),
});

const SetupBody = Type.Object({
	username: Type.String(),
	password: Type.String(),
	server: Type.Object({
		method: Type.Enum({ manual: 'manual', installer: 'installer' }),
		fxserverPath: Type.String(),
		resourcePath: Type.String(),
	}),
	customGroups: Type.Array(AdminGroupSchema),
});

type SetupBodyType = Static<typeof SetupBody>;

const SetupEndpoint: FastifyPluginAsync = async (fastify) => {
	fastify.get('/detect', async (request, reply) => {
		if (isFxManagerSetup()) {
			return reply.code(403).send({ success: false, error: 'Already set up' });
		}

		if (!setupTokenManager.validate(request.headers['x-setup-token'])) {
			return reply
				.code(401)
				.send({ success: false, error: 'Invalid setup token' });
		}

		const cfg = ConfigManager.getInstance().getFxServerValues();
		const cfgPath = path.isAbsolute(cfg.serverConfigFile)
			? cfg.serverConfigFile
			: path.join(cfg.serverDataPath, cfg.serverConfigFile);

		const [executable, dataPath, cfgFound] = await Promise.all([
			fileExists(cfg.executablePath),
			fileExists(cfg.serverDataPath),
			fileExists(cfgPath),
		]);

		return {
			success: true,
			data: {
				executable: cfg.executablePath,
				dataPath: cfg.serverDataPath,
				cfgPath,
				found: { executable, dataPath, cfg: cfgFound },
			},
		} satisfies ApiResponse<DetectResult>;
	});

	fastify.post('/checkfiles', async (request, reply) => {
		if (isFxManagerSetup()) {
			return reply.code(403).send({ success: false, error: 'Already set up' });
		}

		if (!setupTokenManager.validate(request.headers['x-setup-token'])) {
			return reply
				.code(401)
				.send({ success: false, error: 'Invalid setup token' });
		}

		const body = request.body as { fxserverPath: string; dataPath: string };

		const result = await ConfigManager.getInstance().checkFXServerPaths(
			body.fxserverPath,
			body.dataPath,
		);

		return {
			success: true,
			data: {
				executable: result.files.executable,
				dataPath: result.files.serverdata,
				cfgPath: result.files.cfg,
				found: {
					executable: result.exists.executable,
					dataPath: result.exists.serverdata,
					cfg: result.exists.cfg,
				},
			},
		} satisfies ApiResponse<DetectResult>;
	});

	fastify.post<{ Body: SetupBodyType }>(
		'/',
		{ schema: { body: SetupBody } },
		async (request, reply) => {
			if (isFxManagerSetup()) {
				return reply.code(403).send({ error: 'Already set up' });
			}

			if (!setupTokenManager.validate(request.headers['x-setup-token'])) {
				return reply.code(401).send({ error: 'Invalid setup token' });
			}

			const { username, password, server, customGroups } = request.body;

			repo.settings.set('fxserver.executablePath', server.fxserverPath);
			repo.settings.set('fxserver.serverDataPath', server.resourcePath);

			if (customGroups.length > 0) {
				try {
					for (const group of repo.groups.list()) {
						if (group.memberCount === 0) repo.groups.delete(group.id);
					}

					for (const group of customGroups) {
						repo.groups.create({
							name: group.name,
							permissions: group.permissions,
							colour: group.colour ?? '#ffffff',
							icon: group.icon,
						});
					}
				} catch (err) {
					const message = (err as Error).message;
					const detail =
						message === 'slug_conflict'
							? 'two groups resolve to the same name'
							: message === 'invalid_slug'
								? 'a group name has no letters or numbers'
								: message;
					return reply.code(400).send({
						error: `Failed to store admin groups: ${detail}`,
					});
				}
			}

			const user = await repo.auth.createUser(
				username,
				password,
				UserPermissions.MASTER,
				true,
			);

			const session = repo.auth.createSession(user.id);

			setupTokenManager.clear();

			return reply
				.setCookie(COOKIE_NAME, session.id, {
					httpOnly: true, // not accessible from JS
					secure: request.protocol === 'https',
					sameSite: 'lax',
					path: '/',
					maxAge: 60 * 60 * 24 * 7, // 1 week in seconds
				})
				.code(201)
				.send({ success: true });
		},
	);
};

export default {
	prefix: '/setup',
	handler: SetupEndpoint,
} satisfies RouteModule;
