import path from 'node:path';
import { access } from 'node:fs/promises';
import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { repo } from '@fxmanager/database';
import { UserPermissions } from '@fxmanager/shared/constants';
import type { ApiResponse } from '@fxmanager/shared/types';
import {
	COOKIE_NAME,
	isFxManagerSetup,
	isProduction,
} from '../../common/utils';
import { ConfigManager } from '../../modules/config/manager';
import type { RouteModule } from '../../types';

interface DetectResult {
	executable: string;
	dataPath: string;
	cfgPath: string;
	found: { executable: boolean; dataPath: boolean; cfg: boolean };
}

async function fileExists(target: string): Promise<boolean> {
	try {
		await access(target);
		return true;
	} catch {
		return false;
	}
}

const AdminGroupSchema = Type.Object({
	label: Type.String(),
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
	fastify.get('/detect', async (_request, reply) => {
		if (isFxManagerSetup()) {
			return reply.code(403).send({ success: false, error: 'Already set up' });
		}

		const cfg = ConfigManager.getInstance().getFxServerValues();
		const cfgPath = path.isAbsolute(cfg.serverConfigFile)
			? cfg.serverConfigFile
			: path.join(cfg.serverDataPath, cfg.serverConfigFile);

		const [executable, dataPath, cfgFound] = await Promise.all([
			fileExists(cfg.executable),
			fileExists(cfg.serverDataPath),
			fileExists(cfgPath),
		]);

		return {
			success: true,
			data: {
				executable: cfg.executable,
				dataPath: cfg.serverDataPath,
				cfgPath,
				found: { executable, dataPath, cfg: cfgFound },
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

			const { username, password, server, customGroups } = request.body;

			repo.settings.set('executable', server.fxserverPath);
			repo.settings.set('serverDataPath', server.resourcePath);

			// ToDo:
			// Store admin groups in the database
			// await repo.settings.set('admingroups', customGroups);
			console.log('customGroups', customGroups);

			const user = await repo.auth.createUser(
				username,
				password,
				UserPermissions.MASTER,
				true,
			);

			const session = repo.auth.createSession(user.id);

			return reply
				.setCookie(COOKIE_NAME, session.id, {
					httpOnly: true, // not accessible from JS
					secure: isProduction, // HTTPS only in prod
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
