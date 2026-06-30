import type { AdminGroup } from '../types';

// acts like an enum
export const UserPermissions = {
	NONE: 0,
	KICK: 1 << 0, // 1
	BAN: 1 << 1, // 2
	WARN: 1 << 2, // 4
	REVOKE_KICK: 1 << 3, // 8
	REVOKE_BAN: 1 << 4, // 16
	REVOKE_WARN: 1 << 5, // 32

	WHITELIST: 1 << 6, // 64
	REVOKE_WHITELIST: 1 << 7, // 128

	VIEW_REPORT: 1 << 8, // 256
	SEND_REPORT: 1 << 9, // 512
	CLOSE_REPORT: 1 << 10, // 1024

	SERVER_ACTIONS: 1 << 11, // 2048 - start/stop/restart

	CONSOLE_VIEW: 1 << 12, // 4096 - view console
	CONSOLE_ACCESS: 1 << 13, // 4096 - execute console commands

	SETTINGS_ACCESS: 1 << 14, // 8192 - access & edit settings
	SETTINGS_ADMIN_MANAGEMENT: 1 << 15, // 32768 - access & edit admins

	RESOURCE_LIST: 1 << 16, // 65536 - view & (re)start/stop resources

	AUDIT_LOG: 1 << 17, // 131072 - view audit logs
	PERFORMANCE: 1 << 18, // 262144 - view perfomance data

	CONFIG_EDITOR: 1 << 19, // 524288 - access & edit server.cfg files

	MASTER: 1 << 30, // 1073741824
} as const;

export const PERMISSION_LABELS: Record<
	number,
	{ label: string; desc: string; category: string }
> = {
	[UserPermissions.KICK]: {
		label: 'Kick Players',
		desc: 'Disconnect players from the server.',
		category: 'Moderation',
	},
	[UserPermissions.BAN]: {
		label: 'Ban Players',
		desc: 'Prevent players from reconnecting.',
		category: 'Moderation',
	},
	[UserPermissions.WARN]: {
		label: 'Warn Players',
		desc: 'Issue formal warnings to users.',
		category: 'Moderation',
	},
	[UserPermissions.REVOKE_KICK]: {
		label: 'Revoke Kicks',
		desc: 'Clear kick history for players.',
		category: 'Moderation',
	},
	[UserPermissions.REVOKE_BAN]: {
		label: 'Revoke Bans',
		desc: 'Unban players from the server.',
		category: 'Moderation',
	},
	[UserPermissions.REVOKE_WARN]: {
		label: 'Revoke Warns',
		desc: 'Remove warnings from player profiles.',
		category: 'Moderation',
	},

	[UserPermissions.WHITELIST]: {
		label: 'Add Whitelist',
		desc: 'Grant whitelist access to players.',
		category: 'Access Control',
	},
	[UserPermissions.REVOKE_WHITELIST]: {
		label: 'Remove Whitelist',
		desc: 'Strip whitelist access from players.',
		category: 'Access Control',
	},

	[UserPermissions.VIEW_REPORT]: {
		label: 'View Reports',
		desc: 'Read incoming player reports.',
		category: 'Reporting',
	},
	[UserPermissions.SEND_REPORT]: {
		label: 'Reply to Reports',
		desc: 'Send messages within report threads.',
		category: 'Reporting',
	},
	[UserPermissions.CLOSE_REPORT]: {
		label: 'Resolve Reports',
		desc: 'Mark reports as closed or resolved.',
		category: 'Reporting',
	},

	[UserPermissions.SERVER_ACTIONS]: {
		label: 'Power Actions',
		desc: 'Start, stop, or restart the server.',
		category: 'System',
	},
	[UserPermissions.CONSOLE_VIEW]: {
		label: 'View Console',
		desc: 'Read-only access to live server logs.',
		category: 'System',
	},
	[UserPermissions.CONSOLE_ACCESS]: {
		label: 'Execute Console',
		desc: 'Run commands directly via console.',
		category: 'System',
	},

	[UserPermissions.AUDIT_LOG]: {
		label: 'Audit log',
		desc: 'View the history of all staff actions and system events.',
		category: 'Administration',
	},
	[UserPermissions.PERFORMANCE]: {
		label: 'Perfomance',
		desc: 'View server performance data.',
		category: 'Administration',
	},
	[UserPermissions.RESOURCE_LIST]: {
		label: 'Resource list',
		desc: 'Start, stop and restart resources.',
		category: 'Administration',
	},
	[UserPermissions.SETTINGS_ACCESS]: {
		label: 'System Settings',
		desc: 'Modify global server configuration.',
		category: 'Administration',
	},
	[UserPermissions.CONFIG_EDITOR]: {
		label: 'Config Editor',
		desc: 'Edit server.cfg and the files it includes.',
		category: 'Administration',
	},
	[UserPermissions.SETTINGS_ADMIN_MANAGEMENT]: {
		label: 'Manage Admins',
		desc: 'Create, edit, and delete admin users.',
		category: 'Administration',
	},
};

// ToDo: move to dynamic loading from DB
export const PERMISSION_GROUPS: AdminGroup[] = [
	{
		label: 'Master Account',
		permissions: 1073741824,
		colour: '#FF0000',
		icon: 'Star',
	},
	{
		label: 'Development',
		permissions: 292864,
		colour: '#00FF00',
		icon: 'FileCode',
	},
	{
		label: 'Management',
		permissions: 167935,
		colour: '#0000FF',
		icon: 'UserRoundKey',
	},
	{
		label: 'Moderation',
		permissions: 1991,
		colour: '#ff6600',
		icon: 'Shield',
	},
];
