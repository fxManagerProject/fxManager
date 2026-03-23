import Elysia, { t } from 'elysia';
import { sessionAuth } from '../../middleware/session-auth';
import { IGameManager } from '@fxmanager/types';

export const gameRoutes = (gm: IGameManager) =>
  new Elysia({ prefix: '/game' })

    .use(sessionAuth)

    .get('/playerlist', () => {
      const players = gm.getPlayerList();

      return {
        success: true,
        data: players,
      };
    });
