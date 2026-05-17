import type { Migration } from '../types';

export const m0001_dapper_landau: Migration = {
	version: 1,
	description: 'Added whitelisted identifers table',
	up: [
		`CREATE TABLE \`whitelisted_identifiers\` (
    	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    	\`type\` text NOT NULL,
    	\`value\` text NOT NULL,
    	\`added\` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,
		`PRAGMA foreign_keys=OFF`,
		`CREATE TABLE \`__new_bans\` (
    	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    	\`player_id\` integer NOT NULL,
    	\`reason\` text NOT NULL,
    	\`issuer\` integer,
    	\`expires_at\` integer,
    	\`created_at\` integer NOT NULL,
    	\`revoked_at\` integer,
    	FOREIGN KEY (\`player_id\`) REFERENCES \`players\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    	FOREIGN KEY (\`issuer\`) REFERENCES \`admin_users\`(\`id\`) ON UPDATE no action ON DELETE set null
    )`,
		`INSERT INTO \`__new_bans\`("id", "player_id", "reason", "issuer", "expires_at", "created_at", "revoked_at") SELECT "id", "player_id", "reason", "issuer", "expires_at", "created_at", "revoked_at" FROM \`bans\``,
		`DROP TABLE \`bans\``,
		`ALTER TABLE \`__new_bans\` RENAME TO \`bans\``,
		`PRAGMA foreign_keys=ON`,
		`CREATE INDEX \`bans_player_idx\` ON \`bans\` (\`player_id\`)`,
	],
};
