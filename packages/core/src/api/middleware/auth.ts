import Elysia from 'elysia';
import { loadConfig } from '../../config';

const { resourceApiToken } = loadConfig();

export const resourceAuth = new Elysia({ name: 'resource-auth' }).derive(
  { as: 'scoped' },
  ({ headers, status }) => {
    const token = headers['x-resource-token'];
    if (!token) return status(401, { error: 'Missing token' });

    if (token !== resourceApiToken) return status(403, { error: 'Invalid token' });

    return;
  },
);
