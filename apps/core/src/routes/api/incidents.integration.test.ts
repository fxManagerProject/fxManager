import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
} from 'bun:test';
import { Database } from 'bun:sqlite';
import Fastify, {
	type FastifyInstance,
	type FastifyPluginAsync,
	type FastifyReply,
	type FastifyRequest,
} from 'fastify';
import { UserPermissions as P } from '@fxmanager/shared/constants';
import {
	migrations,
	runMigrations,
} from '../../../../../packages/database/src/migrations';
import {
	IncidentsRepository,
	IncidentInputError,
} from '../../../../../packages/database/src/repositories/incidents';
import { redactIncidentText } from '../../modules/incidents/redact';

const db = new Database(':memory:');
db.run('PRAGMA foreign_keys = ON');
runMigrations(db, migrations);
db.run(
	"INSERT INTO admin_users(id, username, password_hash, created_at) VALUES (1, 'admin', 'unused', 0)",
);
const incidents = new IncidentsRepository(db);
let permissions: number = P.MASTER;
let authenticated = true;
const audit = mock(() => {});
mock.module('@fxmanager/database', () => ({
	repo: { incidents, audit: { log: audit } },
	IncidentInputError,
}));
mock.module('../../middleware/session', () => ({
	sessionAuth: async (request: FastifyRequest, reply: FastifyReply) => {
		if (!authenticated)
			return reply.code(401).send({ message: 'Not authenticated' });
		request.admin = { id: 1, username: 'admin', permissions };
	},
}));
mock.module('../../modules/incidents/manager', () => ({
	incidentRecorder: { flush: () => {} },
	incidentSecrets: () => ['known-secret'],
	redactIncidentInput: (text: string) =>
		redactIncidentText(text, ['known-secret']),
}));
const { default: module } = await import('./incidents');

describe('incident API', () => {
	let app: FastifyInstance;
	let now: number;
	const create = () =>
		app.inject({
			method: 'POST',
			url: '/incidents/',
			payload: {
				title: 'known-secret outage',
				description: 'Investigate license:private',
				from: now - 1000,
				to: now,
			},
		});
	beforeAll(async () => {
		app = Fastify();
		await app.register(module.handler as FastifyPluginAsync, {
			prefix: '/incidents',
		});
		await app.ready();
	});
	beforeEach(() => {
		now = Date.now();
		permissions = P.MASTER;
		authenticated = true;
		audit.mockClear();
		db.run('DELETE FROM incidents');
		db.run('DELETE FROM incident_events');
		db.run('DELETE FROM settings');
		incidents.append([
			{
				ts: now,
				kind: 'console',
				summary: 'license:private Player real name known-secret',
				data: { source: 'stdout' },
			},
			{
				ts: now,
				kind: 'disconnect',
				summary: 'Disconnect',
				data: { category: 'timeout' },
			},
		]);
	});
	afterAll(async () => {
		await app.close();
		db.close();
	});

	it('requires authentication and view access, including exports and settings', async () => {
		authenticated = false;
		expect((await app.inject('/incidents/')).statusCode).toBe(401);
		authenticated = true;
		permissions = P.INCIDENT_EXPORT | P.INCIDENT_MANAGE;
		for (const url of [
			'/incidents/',
			'/incidents/storage',
			'/incidents/1/export',
		])
			expect((await app.inject(url)).statusCode).toBe(403);
	});
	it('separates viewing, mutation, export, and retention permissions', async () => {
		const id = (await create()).json().id;
		permissions = P.INCIDENT_VIEW;
		expect((await app.inject(`/incidents/${id}`)).statusCode).toBe(200);
		expect((await create()).statusCode).toBe(403);
		expect((await app.inject(`/incidents/${id}/export`)).statusCode).toBe(403);
		expect(
			(
				await app.inject({
					method: 'POST',
					url: `/incidents/${id}/notes`,
					payload: { content: 'note' },
				})
			).statusCode,
		).toBe(403);
		expect(
			(
				await app.inject({
					method: 'POST',
					url: `/incidents/${id}/status`,
					payload: { status: 'resolved' },
				})
			).statusCode,
		).toBe(403);
		permissions |= P.INCIDENT_MANAGE;
		expect(
			(
				await app.inject({
					method: 'POST',
					url: '/incidents/storage',
					payload: { retentionDays: 7, maxStorageMB: 32 },
				})
			).statusCode,
		).toBe(403);
	});
	it('creates, annotates, resolves, reopens and exports without raw private text', async () => {
		const created = await create();
		expect(created.statusCode).toBe(201);
		const incident = created.json();
		expect(incident.title).toBe('[REDACTED] outage');
		const note = await app.inject({
			method: 'POST',
			url: `/incidents/${incident.id}/notes`,
			payload: { content: 'Investigated known-secret' },
		});
		expect(note.json().notes[0].content).toBe('Investigated [REDACTED]');
		for (const status of ['resolved', 'open']) {
			const result = await app.inject({
				method: 'POST',
				url: `/incidents/${incident.id}/status`,
				payload: { status },
			});
			expect(result.json().status).toBe(status);
		}
		permissions = P.INCIDENT_VIEW | P.INCIDENT_EXPORT;
		const exported = await app.inject(`/incidents/${incident.id}/export`);
		expect(exported.statusCode).toBe(200);
		expect(exported.headers['content-disposition']).toContain('attachment;');
		for (const privateText of [
			'known-secret',
			'license:private',
			'Player real name',
			'Investigated',
		])
			expect(exported.body).not.toContain(privateText);
		expect(exported.json().evidence[1].data.category).toBe('timeout');
		expect(audit).toHaveBeenCalledTimes(5);
	});
	it('validates time ranges, identifiers, empty input and storage limits', async () => {
		for (const query of [
			`from=${now}&to=${now - 1}`,
			`from=0&to=${now}`,
			'from=invalid&to=5',
			`from=${now}&to=${now + 60000}`,
		])
			expect(
				(await app.inject(`/incidents/timeline?${query}`)).statusCode,
			).toBe(400);
		expect((await app.inject('/incidents/not-a-number')).statusCode).toBe(400);
		expect((await app.inject('/incidents/999999')).statusCode).toBe(404);
		expect(
			(
				await app.inject({
					method: 'POST',
					url: '/incidents/',
					payload: { title: '   ', description: '', from: now, to: now },
				})
			).statusCode,
		).toBe(400);
		expect(
			(
				await app.inject({
					method: 'POST',
					url: '/incidents/storage',
					payload: { retentionDays: 0, maxStorageMB: 1 },
				})
			).statusCode,
		).toBe(400);
	});
});
