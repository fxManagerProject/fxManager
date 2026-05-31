import type { RouteModule } from '../../../types';
import { sessionAuth } from '../../../middleware/session';
import AdminManagementModule from './admins';
import AuditLogModule from './audit';

const SettingsEndpoints: RouteModule['handler'] = async (
	fastify,
	{ pm, gm },
) => {
	// enforces that admin key exists in request otherwise returns 401
	fastify.addHook('preHandler', sessionAuth);

	fastify.register(AdminManagementModule.handler, {
		prefix: AdminManagementModule.prefix,
		pm,
		gm,
	});

	fastify.register(AuditLogModule.handler, {
		prefix: AuditLogModule.prefix,
		pm,
		gm,
	});
};

export default {
	prefix: '/settings',
	handler: SettingsEndpoints,
} satisfies RouteModule;
