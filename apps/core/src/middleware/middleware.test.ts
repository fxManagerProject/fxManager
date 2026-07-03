/** biome-ignore-all lint/suspicious/noExplicitAny lint/complexity/noBannedTypes: explicit any allows testing hidden state properties & mocking fastify requests/replies */
import {
	afterAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from 'bun:test';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ConfigManager } from '../modules/config/manager';
import { repo } from '@fxmanager/database';
import { COOKIE_NAME } from '../common/utils';
import { resourceAuth } from './resource';
import { sessionAuth } from './session';

// Shared mock constants
const MOCK_SYSTEM_TOKEN = 'secure-resource-api-token';

// Establish spies on external dependencies to isolate runtime behavior safely
const mockGetSystemValues = mock(() => ({
	resourceApiToken: MOCK_SYSTEM_TOKEN,
}));

const getInstanceSpy = spyOn(ConfigManager, 'getInstance').mockReturnValue({
	getSystemValues: mockGetSystemValues,
} as any);

const validateSessionSpy = spyOn(repo.auth, 'validateSession');

// Helper factory to yield a fresh mock Fastify Reply context per test case
const createMockReply = () => {
	const reply: any = {};
	reply.code = mock(() => reply);
	reply.status = mock(() => reply);
	reply.send = mock(() => reply);
	return reply as unknown as FastifyReply;
};

describe('Auth Middleware Suite', () => {
	beforeEach(() => {
		mockGetSystemValues.mockClear();
		validateSessionSpy.mockClear();
	});

	afterAll(() => {
		// Restore shared module implementations to prevent cross-file side-effects
		getInstanceSpy.mockRestore();
		validateSessionSpy.mockRestore();
	});

	describe('resourceAuth()', () => {
		it('should successfully pass validation if a correct x-resource-token header is delivered', async () => {
			const req = {
				headers: {
					'x-resource-token': MOCK_SYSTEM_TOKEN,
				},
			} as unknown as FastifyRequest;

			const reply = createMockReply();

			const result = await resourceAuth(req, reply);

			// A successful Fastify hook should return undefined (not invoke reply methods)
			expect(result).toBeUndefined();
			expect(reply.code).not.toHaveBeenCalled();
			expect(reply.send).not.toHaveBeenCalled();
		});

		it('should block execution and return 401 Unauthorized if the x-resource-token header is missing', async () => {
			const req = {
				headers: {},
			} as unknown as FastifyRequest;

			const reply = createMockReply();

			await resourceAuth(req, reply);

			expect(reply.code).toHaveBeenCalledWith(401);
			expect(reply.send).toHaveBeenCalledWith({ error: 'Unauthorized' });
		});

		it('should block execution and return 401 Unauthorized if the provided token does not match internal system configuration configurations', async () => {
			const req = {
				headers: {
					'x-resource-token': 'an-incorrect-malicious-token',
				},
			} as unknown as FastifyRequest;

			const reply = createMockReply();

			await resourceAuth(req, reply);

			expect(reply.code).toHaveBeenCalledWith(401);
			expect(reply.send).toHaveBeenCalledWith({ error: 'Unauthorized' });
		});
	});

	describe('sessionAuth()', () => {
		it('should successfully validate session, append admin details onto request scope, and bypass early exit sequences', async () => {
			const mockSessionId = 'valid-active-session-id';
			const mockAdminUser = {
				user: {
					id: 42,
					username: 'admin_root',
					permissions: 2,
				},
				group: { id: 1, permissions: 4 },
				effectivePermissions: 6,
			};

			validateSessionSpy.mockReturnValue(mockAdminUser as any);

			const req = {
				cookies: {
					[COOKIE_NAME]: mockSessionId,
				},
				admin: undefined,
			} as unknown as any;

			const reply = createMockReply();

			await sessionAuth(req, reply);

			expect(validateSessionSpy).toHaveBeenCalledWith(mockSessionId);
			expect(reply.status).not.toHaveBeenCalled();

			// Ensure contextual mutations successfully bind to Request payload
			// permissions must be the group-aware effective bitfield
			expect(req.admin).toEqual({
				id: mockAdminUser.user.id,
				username: mockAdminUser.user.username,
				permissions: mockAdminUser.effectivePermissions,
			});
		});

		it('should return 401 Not authenticated if the cookie parameters completely omit the configured COOKIE_NAME key string', async () => {
			const req = {
				cookies: {},
			} as unknown as FastifyRequest;

			const reply = createMockReply();

			await sessionAuth(req, reply);

			expect(validateSessionSpy).not.toHaveBeenCalled();
			expect(reply.status).toHaveBeenCalledWith(401);
			expect(reply.send).toHaveBeenCalledWith({ error: 'Not authenticated' });
		});

		it('should handle undefined cookie contexts gracefully and fail safely with a 401 status flag', async () => {
			const req = {
				cookies: undefined,
			} as unknown as FastifyRequest;

			const reply = createMockReply();

			await sessionAuth(req, reply);

			expect(reply.status).toHaveBeenCalledWith(401);
			expect(reply.send).toHaveBeenCalledWith({ error: 'Not authenticated' });
		});

		it('should return 401 Session expired if the persistent db layer reports that the session configuration has expired or is invalid', async () => {
			const mockSessionId = 'expired-or-sabotaged-session-id';

			// Simulate session validation failure/expiration from database repository layer
			validateSessionSpy.mockReturnValue(null as any);

			const req = {
				cookies: {
					[COOKIE_NAME]: mockSessionId,
				},
			} as unknown as FastifyRequest;

			const reply = createMockReply();

			await sessionAuth(req, reply);

			expect(validateSessionSpy).toHaveBeenCalledWith(mockSessionId);
			expect(reply.status).toHaveBeenCalledWith(401);
			expect(reply.send).toHaveBeenCalledWith({ error: 'Session expired' });
		});
	});
});
