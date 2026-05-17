import {
	LayoutDashboard,
	Terminal,
	Users,
	Settings,
	LayoutList,
	ScanEye,
} from 'lucide-react';
import type { NavItem } from '@/types/sidebar';
import { UserPermissions } from '@fxmanager/shared/constants';

export const NAV: NavItem[] = [
	{
		url: '/dashboard',
		icon: LayoutDashboard,
		title: 'Dashboard',
		items: [
			{ url: '/dashboard/', title: 'Server Controls' },
			{ url: '/dashboard/players', title: 'Player List' },
		],
	},
	{
		url: '/console',
		icon: Terminal,
		title: 'Console',
		permission: UserPermissions.CONSOLE_ACCESS,
	},
	{
		url: '/resources',
		icon: LayoutList,
		title: 'Resource List',
		permission: UserPermissions.CONSOLE_ACCESS,
	},
	{ url: '/whitelist', icon: ScanEye, title: 'Whitelist' },
	{ url: '/players', icon: Users, title: 'Players' },
	{
		url: '/settings',
		icon: Settings,
		title: 'Settings',
		permission: UserPermissions.SETTINGS_ACCESS,
		items: [
			{ url: '/settings/', title: 'Settings' },
			{
				url: '/settings/admins/',
				title: 'Admin List',
				permission: UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
			},
		],
	},
];
