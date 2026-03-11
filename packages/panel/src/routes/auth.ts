import Elysia, { t } from 'elysia';
import { repo } from '@fxmanager/database';

const COOKIE_NAME = 'fp_session';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
};

export const authRoutes = new Elysia({ prefix: '/auth' })

  .get('/status', () => {
    const hasUsers = repo.auth.countUsers() > 0;
    return { configured: hasUsers };
  })

  .post(
    '/setup',
    async ({ body, cookie, status }) => {
      if (repo.auth.countUsers() > 0) return status(403, { error: 'Setup already completed' });
      
      const user = await repo.auth.createUser(body.username, body.password);
      const session = repo.auth.createSession(user!.id);

      cookie[COOKIE_NAME].set({ value: session!.id, ...COOKIE_OPTS });

      return { success: true, username: user!.username };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 3 }),
        password: t.String({ minLength: 8 }),
      }),
    },
  )

  .post(
    '/login',
    async ({ body, cookie, status }) => {
      const user = await repo.auth.verifyPassword(body.username, body.password);

      if (!user) return status(401, { error: 'Invalid credentials' });

      const session = repo.auth.createSession(user.id);
      cookie[COOKIE_NAME].set({ value: session!.id, ...COOKIE_OPTS });

      return { success: true, username: user.username };
    },
    {
      body: t.Object({ username: t.String(), password: t.String() }),
    },
  )

  .post('/logout', ({ cookie }) => {
    const sessionId = cookie[COOKIE_NAME].value as string;
    if (sessionId) repo.auth.deleteSession(sessionId);
    cookie[COOKIE_NAME].remove();
    return { success: true };
  })

  .get('/me', ({ cookie, status }) => {
    const sessionId = cookie[COOKIE_NAME].value as string;
    if (!sessionId) return status(401, { error: 'Not authenticated' });

    const result = repo.auth.validateSession(sessionId);
    if (!result) return status(401, { error: 'Session expired' });

    return { username: result.user.username, id: result.user.id };
  });
