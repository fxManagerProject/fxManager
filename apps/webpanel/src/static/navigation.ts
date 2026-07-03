import {
	LayoutDashboard,
	Terminal,
	Users,
	LayoutList,
	ScanEye,
	Settings,
	ShieldUser,
	BookUser,
	ScrollText,
	ChartBar,
	FileCog,
	UsersRound,
} from 'lucide-react';
import type { NavCategory } from '@/types/sidebar';
import { UserPermissions } from '@fxmanager/shared/constants';

const NAV_SERVER: NavCategory = {
	title: 'Server Management',
	items: [
		{
			title: 'Dashboard',
			url: '/dashboard',
			icon: LayoutDashboard,
		},
		{
			title: 'Online Players',
			url: '/dashboard/players',
			icon: BookUser,
		},
		{
			title: 'Console',
			url: '/console',
			icon: Terminal,
			permission: UserPermissions.CONSOLE_ACCESS,
		},
		{
			title: 'Resource List',
			url: '/resources',
			icon: LayoutList,
			permission: UserPermissions.RESOURCE_LIST,
		},
		{
			title: 'Performance',
			url: '/perf',
			icon: ChartBar,
			permission: UserPermissions.CONSOLE_ACCESS,
		},
	],
};

const NAV_PLAYERS: NavCategory = {
	title: 'Player Management',
	items: [
		{
			title: 'Players',
			url: '/players',
			icon: Users,
		},
		{
			title: 'Whitelist',
			url: '/whitelist',
			icon: ScanEye,
		},
	],
};

const NAV_CONFIGURATION: NavCategory = {
	title: 'Configuration',
	items: [
		{
			title: 'Settings',
			url: '/settings/',
			icon: Settings,
			permission: UserPermissions.SETTINGS_ACCESS,
		},
		{
			title: 'Config Editor',
			url: '/settings/config',
			icon: FileCog,
			permission: UserPermissions.CONFIG_EDITOR,
		},
		{
			url: '/settings/admins/',
			title: 'Admins',
			icon: ShieldUser,
			permission: UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
		},
		{
			url: '/settings/groups/',
			title: 'Permission Groups',
			icon: UsersRound,
			permission: UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
		},
		{
			url: '/settings/audit/',
			title: 'Audit Logs',
			icon: ScrollText,
			permission: UserPermissions.AUDIT_LOG,
		},
	],
};

export const NAV_GROUPS: NavCategory[] = [
	NAV_SERVER,
	NAV_PLAYERS,
	NAV_CONFIGURATION,
];
