import type { Migration } from '../types';

export const m0008_vengeful_microbe: Migration = {
	version: 8,
	description: 'Add cfx & discord id to adminusers for Oauth',
	up: [
		`ALTER TABLE \`admin_users\` ADD \`cfx_id\` text`,
		`ALTER TABLE \`admin_users\` ADD \`discord_id\` text`,
		`CREATE UNIQUE INDEX \`admin_users_cfx_id_unique\` ON \`admin_users\` (\`cfx_id\`)`,
		`CREATE UNIQUE INDEX \`admin_users_discord_id_unique\` ON \`admin_users\` (\`discord_id\`)`,
		`CREATE INDEX \`admin_cfx_id_idx\` ON \`admin_users\` (\`cfx_id\`)`,
		`CREATE INDEX \`admin_discord_id_idx\` ON \`admin_users\` (\`discord_id\`)`,
	],
};
