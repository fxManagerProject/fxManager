export const AUDIT_LOG_ACTIONS = {
	SERVER: ['server.start', 'server.stop', 'server.restart'],
	PLAYER: [
		'player.warn',
		'player.kick',
		'player.ban',
		'player.note',
		'player.new',
	],
	WHITELIST: ['whitelist.add', 'whitelist.revoke'],
	ADMIN: ['admin.create', 'admin.delete', 'admin.update'],
	GROUP: ['group.create', 'group.delete', 'group.update'],
	REPORT: ['report.close', 'report.join'],
	SETTINGS: ['settings.update'],
	CONFIG: ['config.update'],
	MIGRATE: ['migrate.txadmin'],
} as const;
