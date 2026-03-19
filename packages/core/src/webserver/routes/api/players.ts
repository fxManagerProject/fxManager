import { IGameManager } from '@fxmanager/types';
import Elysia, { t } from 'elysia';
import { resourceAuth } from '../../middleware/auth';

const playerIdentifiers = t.Object({
  license: t.String(),
  fivem: t.Optional(t.String()),
  discord: t.Optional(t.String()),
  steam: t.Optional(t.String()),
});

export const playerApiRoutes = (gm: IGameManager) =>
  new Elysia({ prefix: '/players' })

    .post(
      '/deferrals',
      ({ body }) => {
        return gm.playerDeferralChecks(body.identifiers);
      },
      {
        body: t.Object({
          identifiers: playerIdentifiers,
        }),
      },
    )

    .post(
      '/join',
      ({ body }) => {
        gm.playerJoin(body);
        return { ack: true };
      },
      {
        body: t.Object({
          identifiers: playerIdentifiers,
          name: t.String(),
          serverId: t.Number(),
        }),
      },
    )

    .post(
      '/drop',
      ({ body }) => {
        gm.playerDrop(body.serverId);
        return { ack: true };
      },
      {
        body: t.Object({
          serverId: t.Number(),
        }),
      },
    );
