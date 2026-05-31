import type { Migration } from '../types';

export const m0003_jittery_mystique: Migration = {
	version: 3,
	description: 'Alter target of audit logs to be playerId instead of a string',
	up: [
		`PRAGMA foreign_keys=OFF`,
		`CREATE TABLE \`__new_audit_log\` (
    	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    	\`admin_id\` integer,
    	\`action\` text NOT NULL,
    	\`player_id\` integer,
    	\`metadata\` text,
    	\`created_at\` integer NOT NULL,
    	FOREIGN KEY (\`admin_id\`) REFERENCES \`admin_users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    	FOREIGN KEY (\`player_id\`) REFERENCES \`players\`(\`id\`) ON UPDATE no action ON DELETE set null
    )`,
		`INSERT INTO \`__new_audit_log\`("id", "admin_id", "action", "player_id", "metadata", "created_at") SELECT "id", "admin_id", "action", "player_id", "metadata", "created_at" FROM \`audit_log\``,
		`DROP TABLE \`audit_log\``,
		`ALTER TABLE \`__new_audit_log\` RENAME TO \`audit_log\``,
		`PRAGMA foreign_keys=ON`,
		`CREATE INDEX \`audit_admin_idx\` ON \`audit_log\` (\`admin_id\`)`,
		`CREATE INDEX \`audit_created_idx\` ON \`audit_log\` (\`created_at\`)`,
	],
};
