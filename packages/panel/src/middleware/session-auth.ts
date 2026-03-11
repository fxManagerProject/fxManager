import Elysia from 'elysia';
import { repo } from '@fxmanager/database';

const COOKIE_NAME = 'fp_session';

export const sessionAuth = new Elysia({ name: 'session-auth' }).derive(
  { as: 'scoped' },
  ({ cookie, status }) => {
    const sessionId = cookie[COOKIE_NAME]?.value as string;

    if (!sessionId) return status(401, { error: 'Not authenticated' });
    const result = repo.auth.validateSession(sessionId);

    if (!result) return status(401, { error: 'Session expired' });
    return { admin: { id: result.user.id, username: result.user.username } };
  },
);
