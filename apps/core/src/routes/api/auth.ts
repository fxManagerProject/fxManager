import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { repo } from '@fxmanager/database';

import { COOKIE_NAME } from '../../common/utils';
import { loginRateLimiter } from '../../modules/auth/rate-limiter';
import type { RouteModule } from '../../types';
import { oauthManager } from '../../modules/auth/manager';

const LoginBody = Type.Object({
	username: Type.String(),
	password: Type.String(),
});

type LoginBodyType = Static<typeof LoginBody>;

function getCallbackUri(request: any, provider: string): string {
	const protocol = request.headers['x-forwarded-proto'] || request.protocol;
	const host = request.headers['x-forwarded-host'] || request.headers.host;
	return `${protocol}://${host}/api/auth/oauth/${provider}/callback`;
}

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

	fastify.post('/oauth/:provider/init', async (request, reply) => {
		const { provider: providerName } = request.params as { provider: string };

		if (!oauthManager.hasProvider(providerName)) {
			return reply
				.code(404)
				.send({ error: `Provider '${providerName}' not found.` });
		}

		const provider = oauthManager.getProvider(providerName);

		if (!provider.isConfigured()) {
			return reply.code(400).send({
				error: `${providerName} login is currently unavailable or unconfigured.`,
			});
		}

		const state = crypto.randomBytes(16).toString('hex');
		try {
			const redirectUri = getCallbackUri(request, providerName);
			const url = provider.getAuthUrl(state, redirectUri);

			return reply
				.setCookie('oauth_state', state, {
					httpOnly: true,
					secure: request.protocol === 'https',
					sameSite: 'lax',
					path: '/',
					maxAge: 60 * 10, // 10 minutes
				})
				.send({ url });
		} catch (error) {
			return reply.code(500).send({
				error: error instanceof Error ? error.message : String(error),
			});
		}
	});

	fastify.get('/oauth/:provider/callback', async (request, reply) => {
		const { provider: providerName } = request.params as { provider: string };
		const {
			code,
			state,
			error: providerError,
		} = request.query as {
			code?: string;
			state?: string;
			error?: string;
		};

		const savedState = request.cookies.oauth_state;
		reply.clearCookie('oauth_state', { path: '/' });

		if (providerError) {
			return reply.redirect(`/?error=${encodeURIComponent(providerError)}`);
		}

		if (!state || !savedState || state !== savedState) {
			return reply
				.code(400)
				.send({ error: 'Invalid or expired CSRF state token.' });
		}

		if (!code) {
			return reply.code(400).send({ error: 'Missing authorization code.' });
		}

		try {
			const provider = oauthManager.getProvider(providerName);
			const redirectUri = getCallbackUri(request, providerName);

			const oauthUser = await provider.handleCallback(code, redirectUri);

			const user = repo.auth.findOAuthUser({
				provider: providerName,
				providerId: oauthUser.id,
				username: oauthUser.username,
				email: oauthUser.email,
			});

			if (!user) {
				return reply.redirect(
					`/?error=${encodeURIComponent('OAuth authentication failed.')}`,
				);
			}

			const session = repo.auth.createSession(user.id);

			return reply
				.setCookie(COOKIE_NAME, session.id, {
					httpOnly: true,
					secure: request.protocol === 'https',
					sameSite: 'lax',
					path: '/',
					maxAge: 60 * 60 * 24 * 7,
				})
				.redirect('/');
		} catch (err: any) {
			return reply.redirect(
				`/?error=${encodeURIComponent(err.message || 'OAuth authentication failed.')}`,
			);
		}
	});
};

export default {
	prefix: '/auth',
	handler: AuthEndpoints,
} satisfies RouteModule;
