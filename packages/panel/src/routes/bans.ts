import Elysia, { t } from 'elysia';
import { repo } from '@fxmanager/database';
import { sessionAuth } from '../middleware/session-auth';

export const playerRoutes = new Elysia({ prefix: '/bans' })

  .use(sessionAuth)

  .get(
    '/',
    ({ query }) => {
      return repo.bans.list(Number(query.page ?? 1));
    },
    {
      query: t.Object({ page: t.Optional(t.String()) }),
    },
  )

  .post(
    '/create/:id',
    ({ params, body, admin }) => {
      const player = repo.players.findById(Number(params.id));
      if (!player) throw new Error('Player not found');

      const ban = repo.bans.create({
        playerId: player.id,
        reason: body.reason,
        bannedBy: admin.username,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      });

      repo.audit.log({
        adminId: admin.id,
        action: 'player.ban',
        target: player.name,
        metadata: { reason: body.reason, player: player.id },
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
    '/revoke/:banId',
    ({ params, admin }) => {
      const result = repo.bans.revoke(Number(params.banId));

      repo.audit.log({
        adminId: admin.id,
        action: 'player.unban',
        metadata: { banId: params.banId },
      });

      return result;
    },
    {
      body: t.Object({ adminId: t.String() }),
    },
  );
