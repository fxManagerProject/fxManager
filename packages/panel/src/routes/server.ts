import Elysia, { t } from 'elysia';
import type { IProcessManager } from '@fxmanager/types';
import { repo } from '@fxmanager/database';
import { sessionAuth } from '../middleware/session-auth';

export const serverRoutes = (pm: IProcessManager) =>
  new Elysia({ prefix: '/server' })

    .use(sessionAuth)

    .get('/status', () => pm.getState())

    .post('/start', async ({ admin }) => {
      await pm.start();
      repo.audit.log({ adminId: admin.username, action: 'server.start' });
      return { success: true };
    })

    .post('/stop', async ({ admin }) => {
      await pm.stop();
      repo.audit.log({ adminId: admin.username, action: 'server.stop' });
      return { success: true };
    })

    .post('/restart', async ({ admin }) => {
      await pm.restart();
      repo.audit.log({ adminId: admin.username, action: 'server.restart' });
      return { success: true };
    })

    .post(
      '/command',
      ({ body }) => {
        pm.sendCommand(body.command);
        return { success: true };
      },
      {
        body: t.Object({ command: t.String() }),
      },
    );
