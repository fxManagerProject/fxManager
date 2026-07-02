import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { repo } from '@fxmanager/database';

import { COOKIE_NAME, isProduction } from '../../common/utils';
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
			const { username, password } = request.body as LoginBodyType;

			const user = await repo.auth.verifyPassword(username, password);
			if (!user) {
				return reply.code(401).send({ error: 'Invalid credentials' });
			}

			const session = repo.auth.createSession(user.id);

			return reply
				.setCookie(COOKIE_NAME, session.id, {
					httpOnly: true,
					secure: isProduction,
					sameSite: 'lax',
					path: '/',
					maxAge: 60 * 60 * 24 * 7,
				})
				.send({ success: true });
		},
	);

	fastify.post('/logout', (request, reply) => {
		const sessionId = request.cookies.session_id;

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
			permissions: result.user.permissions,
		};
	});
};

export default {
	prefix: '/auth',
	handler: AuthEndpoints,
} satisfies RouteModule;
