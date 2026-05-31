export type BanTemplate = {
	id: string;
	reason: string;
	duration: string;
};

export type ServerSettings = {
	general: {
		serverName: string;
		language: string;
		theme: string;
		quietMode: boolean;
	};
	fxserver: {
		dataPath: string;
		cfgPath: string;
		autostart: boolean;
		restartOnCrash: boolean;
		onesync: string;
	};
	bans: {
		enabled: boolean;
		requireReason: boolean;
		templates: BanTemplate[];
	};
	whitelist: {
		mode: string;
		discordGuildId: string;
		rejectionMessage: string;
	};
	discord: {
		enabled: boolean;
		token: string;
		guildId: string;
		statusCommand: string;
	};
	game: {
		menuEnabled: boolean;
		menuAlignment: string;
		hideAdminInPunishments: boolean;
		playerModePermission: string;
	};
};

export const mockSettings: ServerSettings = {
	general: {
		serverName: 'fxManager Roleplay',
		language: 'en',
		theme: 'dark',
		quietMode: false,
	},
	fxserver: {
		dataPath: 'C:/FXServer/server-data',
		cfgPath: 'server.cfg',
		autostart: true,
		restartOnCrash: true,
		onesync: 'on',
	},
	bans: {
		enabled: true,
		requireReason: true,
		templates: [
			{ id: '1', reason: 'Cheating / Modding', duration: 'Permanent' },
			{ id: '2', reason: 'Toxicity towards players', duration: '7 days' },
			{ id: '3', reason: 'Breaking server rules', duration: '24 hours' },
		],
	},
	whitelist: {
		mode: 'discord-roles',
		discordGuildId: '123456789012345678',
		rejectionMessage: 'You are not whitelisted on this server.',
	},
	discord: {
		enabled: true,
		token: '••••••••••••••••••••••••••••',
		guildId: '123456789012345678',
		statusCommand: '/status',
	},
	game: {
		menuEnabled: true,
		menuAlignment: 'right',
		hideAdminInPunishments: false,
		playerModePermission: 'admin',
	},
};
