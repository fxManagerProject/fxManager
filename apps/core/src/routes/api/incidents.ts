import { IncidentInputError, repo } from '@fxmanager/database';
import { UserPermissions } from '@fxmanager/shared/constants';
import { PermissionManager } from '@fxmanager/shared/utils';
import {
	INCIDENT_EVENT_KINDS,
	INCIDENT_MAX_RANGE_MS,
	type IncidentEventKind,
	type IncidentLimits,
} from '@fxmanager/shared/types';
import type { FastifyRequest } from 'fastify';
import type { RouteModule } from '../../types';
import { sessionAuth } from '../../middleware/session';
import {
	incidentRecorder,
	incidentSecrets,
	redactIncidentInput,
} from '../../modules/incidents/manager';
import { redactIncidentData } from '../../modules/incidents/redact';

const integer = {
	type: 'integer',
	minimum: 0,
	maximum: Number.MAX_SAFE_INTEGER,
};
const idSchema = {
	type: 'object',
	required: ['id'],
	properties: { id: { ...integer, minimum: 1 } },
	additionalProperties: false,
};
const rangeProperties = { from: integer, to: integer };
const text = (maxLength: number) => ({
	type: 'string',
	minLength: 1,
	maxLength,
	pattern: '\\S',
});

function authorize(request: FastifyRequest, permission: number) {
	if (
		!request.admin ||
		!PermissionManager.has(request.admin.permissions, permission)
	) {
		throw Object.assign(new Error('Not authorized'), { statusCode: 403 });
	}
	return request.admin;
}

function validateRange(from: number, to: number) {
	if (
		from > to ||
		to - from > INCIDENT_MAX_RANGE_MS ||
		to > Date.now() + 1000
	) {
		throw new IncidentInputError(
			'Select a past time range of at most 24 hours.',
		);
	}
}

const handler: RouteModule['handler'] = async (app) => {
	app.addHook('preHandler', sessionAuth);
	app.addHook('preHandler', async (request) => {
		authorize(request, UserPermissions.INCIDENT_VIEW);
	});
	app.setErrorHandler((error, _request, reply) => {
		if (error instanceof IncidentInputError)
			return reply.code(400).send({ message: error.message });
		const status = (error as { statusCode?: number }).statusCode ?? 500;
		if (status >= 500) app.log.error(error);
		return reply.code(status).send({
			message:
				status >= 500
					? 'Incident storage is unavailable. Please try again.'
					: (error as Error).message,
		});
	});

	app.get<{
		Querystring: {
			from: number;
			to: number;
			cursor?: number;
			kind?: IncidentEventKind;
		};
	}>(
		'/timeline',
		{
			schema: {
				querystring: {
					type: 'object',
					required: ['from', 'to'],
					properties: {
						...rangeProperties,
						cursor: integer,
						kind: { type: 'string', enum: INCIDENT_EVENT_KINDS },
					},
					additionalProperties: false,
				},
			},
		},
		async (request) => {
			const { from, to, cursor, kind } = request.query;
			validateRange(from, to);
			incidentRecorder.flush();
			repo.incidents.prune();
			return repo.incidents.timeline(from, to, cursor, kind);
		},
	);

	app.get<{ Querystring: { cursor?: number } }>(
		'/',
		{
			schema: {
				querystring: {
					type: 'object',
					properties: { cursor: integer },
					additionalProperties: false,
				},
			},
		},
		async (request) => {
			repo.incidents.prune();
			return repo.incidents.list(request.query.cursor);
		},
	);

	app.get('/storage', async () => {
		repo.incidents.prune();
		return repo.incidents.storage();
	});
	app.post<{ Body: IncidentLimits }>(
		'/storage',
		{
			schema: {
				body: {
					type: 'object',
					required: ['retentionDays', 'maxStorageMB'],
					properties: {
						retentionDays: { type: 'integer', minimum: 1, maximum: 365 },
						maxStorageMB: { type: 'integer', minimum: 16, maximum: 2048 },
					},
					additionalProperties: false,
				},
			},
		},
		async (request) => {
			const admin = authorize(request, UserPermissions.SETTINGS_ACCESS);
			repo.incidents.setLimits(request.body);
			repo.audit.log({
				adminId: admin.id,
				action: 'incident.retention',
				metadata: { ...request.body },
			});
			return repo.incidents.storage();
		},
	);

	app.post<{
		Body: { title: string; description: string; from: number; to: number };
	}>(
		'/',
		{
			bodyLimit: 16_384,
			schema: {
				body: {
					type: 'object',
					required: ['title', 'description', 'from', 'to'],
					properties: {
						...rangeProperties,
						title: text(160),
						description: { type: 'string', maxLength: 4000 },
					},
					additionalProperties: false,
				},
			},
		},
		async (request, reply) => {
			const admin = authorize(request, UserPermissions.INCIDENT_MANAGE);
			validateRange(request.body.from, request.body.to);
			incidentRecorder.flush();
			const result = repo.incidents.create(
				{
					...request.body,
					title: redactIncidentInput(request.body.title.trim()),
					description: redactIncidentInput(request.body.description.trim()),
				},
				admin.id,
			);
			repo.audit.log({
				adminId: admin.id,
				action: 'incident.create',
				metadata: { incidentId: result?.id },
			});
			return reply.code(201).send(result);
		},
	);

	app.get<{ Params: { id: number } }>(
		'/:id',
		{ schema: { params: idSchema } },
		async (request, reply) => {
			repo.incidents.prune();
			const incident = repo.incidents.get(request.params.id);
			return (
				incident ??
				reply.code(404).send({ message: 'Incident not found or expired.' })
			);
		},
	);

	app.post<{ Params: { id: number }; Body: { content: string } }>(
		'/:id/notes',
		{
			bodyLimit: 16_384,
			schema: {
				params: idSchema,
				body: {
					type: 'object',
					required: ['content'],
					properties: { content: text(4000) },
					additionalProperties: false,
				},
			},
		},
		async (request, reply) => {
			const admin = authorize(request, UserPermissions.INCIDENT_MANAGE);
			repo.incidents.prune();
			const incident = repo.incidents.addNote(
				request.params.id,
				redactIncidentInput(request.body.content.trim()),
				admin.id,
			);
			if (!incident)
				return reply
					.code(404)
					.send({ message: 'Incident not found or expired.' });
			repo.audit.log({
				adminId: admin.id,
				action: 'incident.note',
				metadata: { incidentId: incident.id },
			});
			return incident;
		},
	);

	app.post<{ Params: { id: number }; Body: { status: 'open' | 'resolved' } }>(
		'/:id/status',
		{
			schema: {
				params: idSchema,
				body: {
					type: 'object',
					required: ['status'],
					properties: {
						status: { type: 'string', enum: ['open', 'resolved'] },
					},
					additionalProperties: false,
				},
			},
		},
		async (request, reply) => {
			const admin = authorize(request, UserPermissions.INCIDENT_MANAGE);
			repo.incidents.prune();
			const incident = repo.incidents.setStatus(
				request.params.id,
				request.body.status,
			);
			if (!incident)
				return reply
					.code(404)
					.send({ message: 'Incident not found or expired.' });
			repo.audit.log({
				adminId: admin.id,
				action: 'incident.status',
				metadata: { incidentId: incident.id, status: incident.status },
			});
			return incident;
		},
	);

	app.get<{ Params: { id: number } }>(
		'/:id/export',
		{ schema: { params: idSchema } },
		async (request, reply) => {
			const admin = authorize(request, UserPermissions.INCIDENT_EXPORT);
			repo.incidents.prune();
			const incident = repo.incidents.get(request.params.id);
			if (!incident)
				return reply
					.code(404)
					.send({ message: 'Incident not found or expired.' });
			// Structured allowlist excludes console text and staff free text, which may contain
			// unrecognisable personal data. Keep notes and full evidence inside the panel.
			const secrets = incidentSecrets();
			const bundle = {
				formatVersion: 1,
				exportedAt: Date.now(),
				incident: {
					id: incident.id,
					from: incident.from,
					to: incident.to,
					createdAt: incident.createdAt,
					status: incident.status,
					resolvedAt: incident.resolvedAt,
				},
				privacy:
					'Console text, titles, descriptions, notes, file paths and player identifiers are omitted.',
				evidence: incident.evidence.map((event) => ({
					id: event.id,
					ts: event.ts,
					kind: event.kind,
					data: redactIncidentData(
						event.kind === 'performance'
							? { players: event.data.players, threads: event.data.threads }
							: event.kind === 'server'
								? {
										status: event.data.status,
										previous: event.data.previous,
										code: event.data.code,
									}
								: event.kind === 'disconnect'
									? { category: event.data.category }
									: event.kind === 'resource'
										? { status: event.data.status }
										: event.kind === 'gap'
											? { dropped: event.data.dropped }
											: {},
						secrets,
					),
				})),
			};
			repo.audit.log({
				adminId: admin.id,
				action: 'incident.export',
				metadata: { incidentId: incident.id },
			});
			return reply
				.header(
					'Content-Disposition',
					`attachment; filename="incident-${incident.id}.json"`,
				)
				.header('Cache-Control', 'no-store')
				.send(bundle);
		},
	);
};

export default { prefix: '/incidents', handler } satisfies RouteModule;
