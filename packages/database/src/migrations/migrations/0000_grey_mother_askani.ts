import type { Migration } from '../types';

export const m0000_grey_mother_askani: Migration = {
	version: 0,
	description: 'Initial Migration',
	up: [
		`CREATE TABLE \`admin_users\` (
    	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    	\`username\` text NOT NULL,
    	\`password_hash\` text NOT NULL,
    	\`player_id\` integer,
    	\`permissions\` integer DEFAULT 0 NOT NULL,
    	\`created_at\` integer NOT NULL,
    	\`last_login_at\` integer,
    	FOREIGN KEY (\`player_id\`) REFERENCES \`players\`(\`id\`) ON UPDATE no action ON DELETE set null
    )`,
		`CREATE UNIQUE INDEX \`admin_users_username_unique\` ON \`admin_users\` (\`username\`)`,
		`CREATE INDEX \`admin_username_idx\` ON \`admin_users\` (\`username\`)`,
		`CREATE TABLE \`api_tokens\` (
    	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    	\`name\` text NOT NULL,
    	\`token\` text NOT NULL,
    	\`created_at\` integer NOT NULL,
    	\`last_used\` integer,
    	\`revoked_at\` integer
    )`,
		`CREATE UNIQUE INDEX \`api_tokens_token_unique\` ON \`api_tokens\` (\`token\`)`,
		`CREATE INDEX \`tokens_token_idx\` ON \`api_tokens\` (\`token\`)`,
		`CREATE TABLE \`audit_log\` (
    	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    	\`admin_id\` integer,
    	\`action\` text NOT NULL,
    	\`target\` text,
    	\`metadata\` text,
    	\`created_at\` integer NOT NULL,
    	FOREIGN KEY (\`admin_id\`) REFERENCES \`admin_users\`(\`id\`) ON UPDATE no action ON DELETE cascade
    )`,
		`CREATE INDEX \`audit_admin_idx\` ON \`audit_log\` (\`admin_id\`)`,
		`CREATE INDEX \`audit_created_idx\` ON \`audit_log\` (\`created_at\`)`,
		`CREATE TABLE \`bans\` (
    	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    	\`player_id\` integer NOT NULL,
    	\`reason\` text NOT NULL,
    	\`banned_by\` text NOT NULL,
    	\`expires_at\` integer,
    	\`created_at\` integer NOT NULL,
    	\`revoked_at\` integer,
    	FOREIGN KEY (\`player_id\`) REFERENCES \`players\`(\`id\`) ON UPDATE no action ON DELETE cascade
    )`,
		`CREATE INDEX \`bans_player_idx\` ON \`bans\` (\`player_id\`)`,
		`CREATE TABLE \`kicks\` (
    	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    	\`player_id\` integer NOT NULL,
    	\`reason\` text,
    	\`revoked\` integer DEFAULT 0 NOT NULL,
    	\`issuer\` integer,
    	\`issued_at\` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    	FOREIGN KEY (\`player_id\`) REFERENCES \`players\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    	FOREIGN KEY (\`issuer\`) REFERENCES \`admin_users\`(\`id\`) ON UPDATE no action ON DELETE set null
    )`,
		`CREATE TABLE \`player_identifiers\` (
    	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    	\`player_id\` integer NOT NULL,
    	\`type\` text NOT NULL,
    	\`value\` text NOT NULL,
    	FOREIGN KEY (\`player_id\`) REFERENCES \`players\`(\`id\`) ON UPDATE no action ON DELETE cascade
    )`,
		`CREATE INDEX \`idx_identifier_value\` ON \`player_identifiers\` (\`value\`)`,
		`CREATE UNIQUE INDEX \`player_identifiers_type_value_unique\` ON \`player_identifiers\` (\`type\`,\`value\`)`,
		`CREATE TABLE \`player_notes\` (
    	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    	\`player_id\` integer NOT NULL,
    	\`content\` text,
    	\`issuer\` integer,
    	\`issued_at\` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    	FOREIGN KEY (\`player_id\`) REFERENCES \`players\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    	FOREIGN KEY (\`issuer\`) REFERENCES \`admin_users\`(\`id\`) ON UPDATE no action ON DELETE set null
    )`,
		`CREATE TABLE \`players\` (
    	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    	\`name\` text NOT NULL,
    	\`playtime\` integer DEFAULT 0 NOT NULL,
    	\`first_seen\` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    	\`last_seen\` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,
		`CREATE TABLE \`report_messages\` (
    	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    	\`report_id\` integer,
    	\`player_id\` integer,
    	\`admin_id\` integer,
    	\`message\` text NOT NULL,
    	\`timestamp\` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    	FOREIGN KEY (\`report_id\`) REFERENCES \`reports\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    	FOREIGN KEY (\`player_id\`) REFERENCES \`players\`(\`id\`) ON UPDATE no action ON DELETE set null,
    	FOREIGN KEY (\`admin_id\`) REFERENCES \`admin_users\`(\`id\`) ON UPDATE no action ON DELETE set null
    )`,
		`CREATE TABLE \`reports\` (
    	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    	\`reporter_id\` integer NOT NULL,
    	\`subject\` text NOT NULL,
    	\`status\` text DEFAULT 'open' NOT NULL,
    	\`opened_at\` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    	\`last_action\` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    	FOREIGN KEY (\`reporter_id\`) REFERENCES \`players\`(\`id\`) ON UPDATE no action ON DELETE cascade
    )`,
		`CREATE TABLE \`sessions\` (
    	\`id\` text PRIMARY KEY NOT NULL,
    	\`admin_id\` integer NOT NULL,
    	\`created_at\` integer NOT NULL,
    	\`expires_at\` integer NOT NULL,
    	FOREIGN KEY (\`admin_id\`) REFERENCES \`admin_users\`(\`id\`) ON UPDATE no action ON DELETE cascade
    )`,
		`CREATE INDEX \`sessions_admin_idx\` ON \`sessions\` (\`admin_id\`)`,
		`CREATE TABLE \`settings\` (
    	\`key\` text PRIMARY KEY NOT NULL,
    	\`value\` text NOT NULL,
    	\`updated_at\` integer NOT NULL
    )`,
		`CREATE TABLE \`warns\` (
    	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    	\`player_id\` integer NOT NULL,
    	\`reason\` text,
    	\`read\` integer DEFAULT 0 NOT NULL,
    	\`revoked\` integer DEFAULT 0 NOT NULL,
    	\`issuer\` integer,
    	\`issued_at\` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
    	FOREIGN KEY (\`player_id\`) REFERENCES \`players\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    	FOREIGN KEY (\`issuer\`) REFERENCES \`admin_users\`(\`id\`) ON UPDATE no action ON DELETE set null
    )`,
	],
};
