import type { ComponentType } from 'react';
import { UserPermissions } from '@fxmanager/shared/constants';
import LoginPage from './login';
import DashboardPage from './dashboard';
import OnlinePlayerListPage from './dashboard/playerList';
import ConsolePage from './console';
import PlayersPage from './players';
import SettingsPage from './settings';
import PlayerView from './players/playerview';
import AdminManagementList from './settings/adminmanagement';
import AdminView from './settings/adminview';
import AdminCreate from './settings/admincreate';
import { ResourceList } from './resources';
import WhitelistIndex from './whitelist';
import AuditLogPage from './settings/auditlogs';
import PerformancePage from './performance';

type RouteConfig = {
	path: string;
	element: ComponentType;
	permission?: number;
	auth?: boolean;
	layout?: boolean;
};

export const routes: RouteConfig[] = [
	{ path: '/login', element: LoginPage, auth: false },

	// Server Management
	{ path: '/dashboard', element: DashboardPage },
	{ path: '/dashboard/players', element: OnlinePlayerListPage },
	{
		path: '/console',
		element: ConsolePage,
		permission: UserPermissions.CONSOLE_ACCESS,
	},
	{
		path: '/resources',
		element: ResourceList,
		permission: UserPermissions.RESOURCE_LIST,
	},
	{
		path: '/perf',
		element: PerformancePage,
		permission: UserPermissions.CONSOLE_ACCESS,
	},

	// Player Management
	{ path: '/players', element: PlayersPage },
	{ path: '/players/:playerId', element: PlayerView },
	{
		path: '/whitelist',
		element: WhitelistIndex,
		permission: UserPermissions.WHITELIST,
	},

	// Configuration
	{
		path: '/settings',
		element: SettingsPage,
		permission: UserPermissions.SETTINGS_ACCESS,
	},
	{
		path: '/settings/audit',
		element: AuditLogPage,
		permission: UserPermissions.AUDIT_LOG,
	},
	{
		path: '/settings/admins',
		element: AdminManagementList,
		permission: UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
	},
	{
		path: '/settings/admins/create',
		element: AdminCreate,
		permission: UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
	},
	{
		path: '/settings/admins/:adminId',
		element: AdminView,
		permission: UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
	},
];
