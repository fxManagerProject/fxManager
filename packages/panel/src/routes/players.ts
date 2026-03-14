import Elysia, { t } from 'elysia';
import { repo } from '@fxmanager/database';
import { sessionAuth } from '../middleware/session-auth';

export const playerRoutes = new Elysia({ prefix: '/players' })

  .use(sessionAuth)

  .get(
    '/',
    ({ query }) => {
      const page = Number(query.page ?? 1);
      const pageSize = Number(query.pageSize ?? 50);
      return repo.players.list(page, pageSize);
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
    },
  );
