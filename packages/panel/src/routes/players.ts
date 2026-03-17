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
  })

  .post(
    '/:playerId/notes',
    async ({ params, body, admin }): Promise<ApiResponse> => {
      const playerId = parseInt(params.playerId);

      try {
        await repo.players.updatePlayerNotes(playerId, admin.id, body.content);

        return { success: true, data: null };
      } catch (err) {
        if ((err as Error).message === 'content_too_short') {
          return { success: false, error: 'Content is too short' };
        }
        console.error('An error occured when updating a player notes', { playerId, admin, body });
        return { success: false, error: 'An unkown error occured' };
      }
    },
    {
      body: t.Object({
        content: t.String(),
      }),
    },
  )

  .post(
    '/:playerId/ban',
    async ({ params, body, admin }): Promise<ApiResponse> => {
      const playerId = parseInt(params.playerId);

      try {
        const result = await repo.players.addBan(
          playerId,
          body.expiresAt,
          body.reason,
          admin.username,
        );

        if (result) {
          return {
            success: true,
            data: null,
          };
        } else {
          return {
            success: false,
            error: 'Player is already banned',
          };
        }
      } catch (err) {
        console.error('An error occured when adding a ban to player', { playerId, admin, body });
        return { success: false, error: 'An unkown error occured' };
      }
    },
    {
      body: t.Object({
        reason: t.String({ minLength: 10 }),
        expiresAt: t.Nullable(t.Date()),
      }),
    },
  );
