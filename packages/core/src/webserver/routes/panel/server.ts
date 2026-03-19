import Elysia, { t } from 'elysia';
import { UserPermissions, type IProcessManager } from '@fxmanager/types';
import { repo } from '@fxmanager/database';
import { PermissionManager } from '@fxmanager/utils';
import { sessionAuth } from '../../middleware/session-auth';

export const serverRoutes = (pm: IProcessManager) =>
  new Elysia({ prefix: '/server' })

    .use(sessionAuth)

    .get('/status', () => pm.getState())

    .post('/start', async ({ admin }) => {
      if (!PermissionManager.has(admin.permissions, UserPermissions.SERVER_ACTIONS)) {
        return {
          success: false,
          error: 'Not authorized',
        };
      }

      await pm.start();
      repo.audit.log({ adminId: admin.id, action: 'server.start' });

      return { success: true };
    })

    .post('/stop', async ({ admin }) => {
      if (!PermissionManager.has(admin.permissions, UserPermissions.SERVER_ACTIONS)) {
        return {
          success: false,
          error: 'Not authorized',
        };
      }

      await pm.stop();
      repo.audit.log({ adminId: admin.id, action: 'server.stop' });

      return { success: true };
    })

    .post('/restart', async ({ admin }) => {
      if (!PermissionManager.has(admin.permissions, UserPermissions.SERVER_ACTIONS)) {
        return {
          success: false,
          error: 'Not authorized',
        };
      }
      await pm.restart();
      repo.audit.log({ adminId: admin.id, action: 'server.restart' });

      return { success: true };
    })

    .post(
      '/command',
      ({ body, admin }) => {
        if (!PermissionManager.has(admin.permissions, UserPermissions.CONSOLE_ACCESS)) {
          return {
            success: false,
            error: 'Not authorized',
          };
        }

        pm.sendCommand(body.command);

        return { success: true };
      },
      {
        body: t.Object({ command: t.String() }),
      },
    );
