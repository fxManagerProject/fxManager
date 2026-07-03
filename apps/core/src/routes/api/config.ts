import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { repo } from '@fxmanager/database';
import { UserPermissions } from '@fxmanager/shared/constants';
import type {
	ApiResponse,
	CfgFileContent,
	CfgGraph,
	CreateCfgRequest,
	CreateCfgResult,
	SaveCfgRequest,
	SaveCfgResult,
} from '@fxmanager/shared/types';
import { PermissionManager } from '@fxmanager/shared/utils';
import { sessionAuth } from '../../middleware/session';
import {
	buildCfgGraph,
	findEditableNode,
	resolveNewCfgPath,
} from '../../modules/config/graph';
import { detectManagedConvars } from '../../modules/config/managed';
import { resolveCfgContext } from '../../modules/config/service';
import type { AuthedRequest, RouteModule } from '../../types';

async function mtimeMs(filePath: string): Promise<number | null> {
	try {
		return (await stat(filePath)).mtimeMs;
	} catch {
		return null;
	}
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await stat(filePath);
		return true;
	} catch {
		return false;
	}
}

const ConfigEndpoints: RouteModule['handler'] = async (fastify, options) => {
	const { pm } = options;

	fastify.addHook('preHandler', sessionAuth);

	const canEdit = (perms: number) =>
		PermissionManager.has(perms, UserPermissions.CONFIG_EDITOR);
	const canRestart = (perms: number) =>
		PermissionManager.has(perms, UserPermissions.SERVER_ACTIONS);

	fastify.get('/graph', async (request, reply) => {
		const { admin } = request as AuthedRequest;
		if (!canEdit(admin.permissions)) {
			return reply.code(403).send({ error: 'Not authorized' });
		}

		const { dataDir, entryCfgPath } = resolveCfgContext();
		const graph = await buildCfgGraph(entryCfgPath, { dataDir });
		const startedAt = pm.getState().startedAt?.getTime() ?? null;

		const files = await Promise.all(
			graph.map(async (node) => {
				const mtime = node.exists ? await mtimeMs(node.path) : null;
				const restartNeeded =
					startedAt !== null && mtime !== null && mtime > startedAt;
				return {
					path: node.displayPath,
					depth: node.depth,
					exists: node.exists,
					restartNeeded,
				};
			}),
		);

		return reply.send({
			success: true,
			data: { files, serverRunning: startedAt !== null },
		} satisfies ApiResponse<CfgGraph>);
	});

	fastify.get('/file', async (request, reply) => {
		const { admin } = request as AuthedRequest;
		if (!canEdit(admin.permissions)) {
			return reply.code(403).send({ error: 'Not authorized' });
		}

		const requestPath = (request.query as { path?: string }).path;
		if (!requestPath) {
			return reply.code(400).send({ success: false, error: 'Missing path' });
		}

		const { dataDir, entryCfgPath } = resolveCfgContext();
		const graph = await buildCfgGraph(entryCfgPath, { dataDir });
		const node = findEditableNode(graph, dataDir, requestPath);
		if (!node) {
			return reply.code(403).send({ error: 'File is not part of the config' });
		}

		let content = '';
		let exists = false;
		try {
			content = await readFile(node.path, 'utf8');
			exists = true;
		} catch {
			exists = false;
		}

		return reply.send({
			success: true,
			data: {
				path: node.displayPath,
				content,
				exists,
				managed: detectManagedConvars(content),
			},
		} satisfies ApiResponse<CfgFileContent>);
	});

	fastify.post('/file', async (request, reply) => {
		const { admin } = request as AuthedRequest;
		if (!canEdit(admin.permissions)) {
			return reply.code(403).send({ error: 'Not authorized' });
		}

		const body = request.body as SaveCfgRequest;
		if (!body?.path || typeof body.content !== 'string') {
			return reply
				.code(400)
				.send({ success: false, error: 'Missing path or content' });
		}

		if (body.restart && !canRestart(admin.permissions)) {
			return reply
				.code(403)
				.send({ error: 'Not authorized to restart the server' });
		}

		const { dataDir, entryCfgPath } = resolveCfgContext();
		const graph = await buildCfgGraph(entryCfgPath, { dataDir });
		const node = findEditableNode(graph, dataDir, body.path);
		if (!node) {
			return reply.code(403).send({ error: 'File is not part of the config' });
		}

		try {
			await mkdir(path.dirname(node.path), { recursive: true });
			await writeFile(node.path, body.content, 'utf8');
		} catch (err) {
			return reply.code(500).send({
				success: false,
				error: `Failed to write file: ${(err as Error).message}`,
			});
		}

		repo.audit.log({
			adminId: admin.id,
			action: 'config.update',
			metadata: { path: node.displayPath, restart: !!body.restart },
		});

		let restarted = false;
		if (body.restart) {
			restarted = await pm.restart();
		}

		return reply.send({
			success: true,
			data: { path: node.displayPath, restarted },
		} satisfies ApiResponse<SaveCfgResult>);
	});

	fastify.post('/create', async (request, reply) => {
		const { admin } = request as AuthedRequest;
		if (!canEdit(admin.permissions)) {
			return reply.code(403).send({ error: 'Not authorized' });
		}

		const body = request.body as CreateCfgRequest;
		const { dataDir, entryCfgPath } = resolveCfgContext();
		const target = await resolveNewCfgPath(dataDir, body?.path ?? '');
		if (!target.ok) {
			return reply.code(400).send({ success: false, error: target.error });
		}

		if (await fileExists(target.abs)) {
			return reply.code(409).send({
				success: false,
				error: 'A file with that name already exists',
			});
		}

		try {
			await mkdir(path.dirname(target.abs), { recursive: true });
			await writeFile(target.abs, '', 'utf8');

			await appendFile(
				entryCfgPath,
				`\nexec "${target.displayPath}"\n`,
				'utf8',
			);
		} catch (err) {
			return reply.code(500).send({
				success: false,
				error: `Failed to create file: ${(err as Error).message}`,
			});
		}

		repo.audit.log({
			adminId: admin.id,
			action: 'config.update',
			metadata: { path: target.displayPath, created: true },
		});

		return reply.send({
			success: true,
			data: { path: target.displayPath },
		} satisfies ApiResponse<CreateCfgResult>);
	});
};

export default {
	prefix: '/config',
	handler: ConfigEndpoints,
} satisfies RouteModule;
