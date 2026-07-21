import type { Migration } from '../types';

export const m0006_productive_thor: Migration = {
	version: 6,
	description:
		'Add admin_groups, assign matching admins and clear their personal bitmask',
	up: [
		`CREATE TABLE \`admin_groups\` (
    	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    	\`name\` text NOT NULL,
    	\`permissions\` integer DEFAULT 0 NOT NULL,
    	\`colour\` text DEFAULT '#ffffff' NOT NULL,
    	\`icon\` text,
    	\`created_at\` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,
		`CREATE UNIQUE INDEX \`admin_groups_name_unique\` ON \`admin_groups\` (\`name\`)`,
		`ALTER TABLE \`admin_users\` ADD \`group_id\` integer REFERENCES admin_groups(id)`,
	],
};
