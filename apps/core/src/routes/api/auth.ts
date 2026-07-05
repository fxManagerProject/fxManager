import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { repo } from '@fxmanager/database';

import { COOKIE_NAME } from '../../common/utils';
import { loginRateLimiter } from '../../modules/auth/rate-limiter';
import type { RouteModule } from '../../types';

const LoginBody = Type.Object({
	username: Type.String(),
	password: Type.String(),
});

type LoginBodyType = Static<typeof LoginBody>;

const AuthEndpoints: FastifyPluginAsync = async (fastify) => {
	fastify.post(
		'/login',
		{
			schema: { body: LoginBody },
		},
		async (request, reply) => {
			const rateKey = request.ip;
			const limit = loginRateLimiter.check(rateKey);
			if (!limit.allowed) {
				return reply
					.code(429)
					.header('Retry-After', Math.ceil(limit.retryAfterMs / 1000))
					.send({ error: 'Too many login attempts. Try again later.' });
			}

			const { username, password } = request.body as LoginBodyType;

			const user = await repo.auth.verifyPassword(username, password);
			if (!user) {
				loginRateLimiter.recordFailure(rateKey);
				return reply.code(401).send({ error: 'Invalid credentials' });
			}

			loginRateLimiter.recordSuccess(rateKey);

			const session = repo.auth.createSession(user.id);

			return reply
				.setCookie(COOKIE_NAME, session.id, {
					httpOnly: true,
					secure: request.protocol === 'https',
					sameSite: 'lax',
					path: '/',
					maxAge: 60 * 60 * 24 * 7,
				})
				.send({ success: true });
		},
	);

	fastify.post('/logout', (request, reply) => {
		const sessionId = request.cookies[COOKIE_NAME];

		if (sessionId) {
			repo.auth.deleteSession(sessionId);
		}

		return reply
			.clearCookie(COOKIE_NAME, { path: '/' })
			.send({ success: true });
	});

	fastify.get('/me', (request, reply) => {
		const sessionId = request.cookies[COOKIE_NAME];

		if (!sessionId) {
			return reply.code(401).send({ error: 'Not authenticated' });
		}

		const result = repo.auth.validateSession(sessionId);

		if (!result) {
			return reply.code(401).send({ error: 'Session expired' });
		}

		return {
			username: result.user.username,
			id: result.user.id,
			permissions: result.effectivePermissions,
			group: result.group
				? {
						id: result.group.id,
						name: result.group.name,
						permissions: result.group.permissions,
						colour: result.group.colour,
						icon: result.group.icon,
					}
				: null,
		};
	});
};

export default {
	prefix: '/auth',
	handler: AuthEndpoints,
} satisfies RouteModule;
