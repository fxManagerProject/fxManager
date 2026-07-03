import type { Migration } from '../types';

export const m0006_admin_groups: Migration = {
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
		`ALTER TABLE \`admin_users\` ADD \`group_id\` integer REFERENCES admin_groups(id) ON DELETE SET NULL`,
		`INSERT INTO \`admin_groups\` (\`name\`, \`permissions\`, \`colour\`, \`icon\`) VALUES
	('Development', 292864, '#00FF00', 'FileCode'),
	('Management', 167935, '#0000FF', 'UserRoundKey'),
	('Moderation', 1991, '#ff6600', 'Shield')`,
		`UPDATE \`admin_users\` SET \`group_id\` = (
	SELECT g.\`id\` FROM \`admin_groups\` g
	WHERE g.\`permissions\` = \`admin_users\`.\`permissions\`
) WHERE (\`permissions\` & 1073741824) = 0`,
		`UPDATE \`admin_users\` SET \`permissions\` = 0 WHERE \`group_id\` IS NOT NULL`,
	],
};
