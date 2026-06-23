import type { FastifyRequest } from 'fastify';
import type { AuthedRequest, RouteModule } from '../../types';
import { sessionAuth } from '../../middleware/session';
import { PermissionManager } from '@fxmanager/shared/utils';
import { UserPermissions } from '@fxmanager/shared/constants';
import { repo, type ImportSummary } from '@fxmanager/database';
import type { ApiResponse } from '@fxmanager/shared/types';
import { runMigrateInChildProcess } from '../../migrate-worker';

// txAdmin player databases can be several megabytes; lift the body limit well
// above Fastify's 1MB default for this upload endpoint.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const MigrateEndpoints: RouteModule['handler'] = async (fastify) => {
	fastify.addHook('preHandler', sessionAuth);

	const keepRawBody = (
		_request: FastifyRequest,
		body: string,
		done: (err: Error | null, parsed?: unknown) => void,
	) => done(null, body);

	fastify.addContentTypeParser(
		'application/json',
		{ parseAs: 'string', bodyLimit: MAX_UPLOAD_BYTES },
		keepRawBody,
	);
	fastify.addContentTypeParser(
		'application/octet-stream',
		{ parseAs: 'string', bodyLimit: MAX_UPLOAD_BYTES },
		keepRawBody,
	);

	fastify.post('/', { bodyLimit: MAX_UPLOAD_BYTES }, async (request, reply) => {
		const { admin } = request as AuthedRequest;

		if (!PermissionManager.has(admin.permissions, UserPermissions.MASTER)) {
			return reply.code(403).send({
				success: false,
				error: 'Not authorized',
			});
		}

		try {
			const summary = await runMigrateInChildProcess(request.body as string);

			try {
				repo.audit.log({
					adminId: admin.id,
					action: 'migrate.txadmin',
					metadata: summary as unknown as Record<string, unknown>,
				});
			} catch (auditErr) {
				console.error('/api/migrate audit log failed:', auditErr);
			}

			return {
				success: true,
				data: summary,
			} satisfies ApiResponse<ImportSummary>;
		} catch (err) {
			const message = (err as Error).message;

			if (message === 'invalid_txadmin_db') {
				return reply.code(400).send({
					success: false,
					error: 'Uploaded file is not a valid txAdmin players database',
				});
			}

			console.error('/api/migrate failed:', err);
			return reply.code(500).send({
				success: false,
				error: 'An error occurred while importing the database',
			});
		}
	});
};

export default {
	prefix: '/migrate',
	handler: MigrateEndpoints,
} satisfies RouteModule;
