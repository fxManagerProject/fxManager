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
  )

  .post(
    '/:id/ban',
    ({ params, body }) => {
      const player = repo.players.findById(Number(params.id));
      if (!player) throw new Error('Player not found');

      const ban = repo.bans.create({
        playerId: player.id,
        reason: body.reason,
        bannedBy: body.bannedBy,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      });

      repo.audit.log({
        adminId: body.bannedBy,
        action: 'player.ban',
        target: player.license,
        metadata: { reason: body.reason },
      });

      return ban;
    },
    {
      body: t.Object({
        reason: t.String(),
        bannedBy: t.String(),
        expiresAt: t.Optional(t.String()),
      }),
    },
  )

  .delete(
    '/bans/:banId',
    ({ params, body }) => {
      const result = repo.bans.revoke(Number(params.banId));
      repo.audit.log({
        adminId: body.adminId,
        action: 'player.unban',
        metadata: { banId: params.banId },
      });
      return result;
    },
    {
      body: t.Object({ adminId: t.String() }),
    },
  )

  .get(
    '/bans',
    ({ query }) => {
      return repo.bans.list(Number(query.page ?? 1));
    },
    {
      query: t.Object({ page: t.Optional(t.String()) }),
    },
  );
