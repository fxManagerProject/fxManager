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

	MASTER: 1 << 30, // (1,073,741,824)
} as const;
