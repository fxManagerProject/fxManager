import Elysia, { t } from 'elysia';
import { repo } from '@fxmanager/database';
import { sessionAuth } from '../middleware/session-auth';
import { ApiResponse, PlayerProfile } from '@fxmanager/types';

export const playerRoutes = new Elysia({ prefix: '/players' })

  .use(sessionAuth)

  .get(
    '/',
    ({ query }) => {
      const page = Number(query.page ?? 1);
      const pageSize = Number(query.pageSize ?? 50);
      return repo.players.list(page, pageSize, {
        search: query.search,
        sortBy: query.sortBy as any,
        sortOrder: query.sortOrder as any,
      });
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        search: t.Optional(t.String()),
        sortBy: t.Optional(
          t.Union([t.Literal('playtime'), t.Literal('lastSeen'), t.Literal('firstSeen')]),
        ),
        sortOrder: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
      }),
    },
  )

  .get('/:playerId', async ({ params }): Promise<ApiResponse<PlayerProfile>> => {
    const playerId = parseInt(params.playerId);
    const profile = await repo.players.findById(playerId);

    if (!profile) return { success: false, error: `Player id ${playerId} does not exist.` };

    return { success: true, data: profile };
  });
