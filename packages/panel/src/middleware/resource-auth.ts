import Elysia from 'elysia';
import { repo } from '@fxmanager/database';

export const resourceAuth = new Elysia({ name: 'resource-auth' }).derive(
  { as: 'scoped' },
  ({ headers, status }) => {
    const token = headers['x-resource-token'];
    if (!token) return status(401, { error: 'Missing token' });

    const valid = repo.apiTokens.validate(token);
    if (!valid) return status(403, { error: 'Invalid or revoked token' });

    return { tokenRecord: valid };
  },
);
