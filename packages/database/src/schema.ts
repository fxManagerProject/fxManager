import {
	sqliteTable,
	text,
	integer,
	index,
	unique,
} from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// region Players

export const players = sqliteTable('players', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	playtime: integer('playtime').notNull().default(0), // time in milliseconds !!
	firstSeen: integer('first_seen', { mode: 'timestamp' })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	lastSeen: integer('last_seen', { mode: 'timestamp' })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
});

export const playerIdentifiers = sqliteTable(
	'player_identifiers',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		playerId: integer('player_id')
			.notNull()
			.references(() => players.id, { onDelete: 'cascade' }),
		type: text('type').notNull(), // license, discord, steam, etc.
		value: text('value').notNull(),
	},
	(t) => [
		index('idx_identifier_value').on(t.value),
		unique().on(t.type, t.value),
	],
);

export const whitelistedIdentifers = sqliteTable(
	'whitelisted_identifiers',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		type: text('type').notNull(), // license, discord, steam, etc.
		value: text('value').notNull(),
		adminId: integer('admin_id').references(() => adminUsers.id, {
			onDelete: 'cascade',
		}),
		system: integer('system').default(0).notNull(),
		addedAt: integer('added_at', { mode: 'timestamp' })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(t) => [
		index('idx_whitelist_identifier_value').on(t.value),
		unique().on(t.type, t.value),
	],
);

// region Admins & Sessions

export const adminUsers = sqliteTable(
	'admin_users',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		username: text('username').notNull().unique(),
		passwordHash: text('password_hash').notNull(),
		playerId: integer('player_id').references(() => players.id, {
			onDelete: 'set null',
		}),
		permissions: integer('permissions').default(0).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
	},
	(t) => [index('admin_username_idx').on(t.username)],
);

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		adminId: integer('admin_id')
			.notNull()
			.references(() => adminUsers.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	},
	(t) => [index('sessions_admin_idx').on(t.adminId)],
);

// region Punishments

export const bans = sqliteTable(
	'bans',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		playerId: integer('player_id')
			.notNull()
			.references(() => players.id, { onDelete: 'cascade' }),
		reason: text('reason').notNull(),
		issuer: integer('issuer').references(() => adminUsers.id, {
			onDelete: 'set null',
		}),
		expiresAt: integer('expires_at', { mode: 'timestamp' }),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		revokedAt: integer('revoked_at', { mode: 'timestamp' }),
	},
	(t) => [index('bans_player_idx').on(t.playerId)],
);

export const warns = sqliteTable('warns', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	playerId: integer('player_id')
		.notNull()
		.references(() => players.id, { onDelete: 'cascade' }),
	reason: text('reason'),
	read: integer('read').default(0).notNull(), // 0 not ack'd | 1 ack'd
	revoked: integer('revoked').default(0).notNull(),
	issuer: integer('issuer').references(() => adminUsers.id, {
		onDelete: 'set null',
	}),
	issuedAt: integer('issued_at', { mode: 'timestamp' })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
});

export const kicks = sqliteTable('kicks', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	playerId: integer('player_id')
		.notNull()
		.references(() => players.id, { onDelete: 'cascade' }),
	reason: text('reason'),
	revoked: integer('revoked').default(0).notNull(),
	issuer: integer('issuer').references(() => adminUsers.id, {
		onDelete: 'set null',
	}),
	issuedAt: integer('issued_at', { mode: 'timestamp' })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
});

// region Reports & Notes

export const reports = sqliteTable('reports', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	reporterId: integer('reporter_id')
		.notNull()
		.references(() => players.id, { onDelete: 'cascade' }),
	subject: text('subject').notNull(),
	status: text('status').default('open').notNull(), // open, inprogress, resolved
	openedAt: integer('opened_at', { mode: 'timestamp' })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	lastAction: integer('last_action', { mode: 'timestamp' })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
});

export const reportMessages = sqliteTable('report_messages', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	reportId: integer('report_id').references(() => reports.id, {
		onDelete: 'cascade',
	}),
	playerId: integer('player_id').references(() => players.id, {
		onDelete: 'set null',
	}),
	adminId: integer('admin_id').references(() => adminUsers.id, {
		onDelete: 'set null',
	}),
	message: text('message').notNull(),
	timestamp: integer('timestamp', { mode: 'timestamp' })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
});

export const playerNotes = sqliteTable('player_notes', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	playerId: integer('player_id')
		.notNull()
		.references(() => players.id, { onDelete: 'cascade' }),
	content: text('content'),
	issuer: integer('issuer').references(() => adminUsers.id, {
		onDelete: 'set null',
	}),
	issuedAt: integer('issued_at', { mode: 'timestamp' })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
});

// region System

export const auditLog = sqliteTable(
	'audit_log',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		adminId: integer('admin_id').references(() => adminUsers.id, {
			onDelete: 'cascade',
		}),
		action: text('action').notNull(),
		target: text('target'),
		metadata: text('metadata', { mode: 'json' }).$type<
			Record<string, unknown>
		>(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	},
	(t) => [
		index('audit_admin_idx').on(t.adminId),
		index('audit_created_idx').on(t.createdAt),
	],
);

export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull().$type<unknown>(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const apiTokens = sqliteTable(
	'api_tokens',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull(),
		token: text('token').notNull().unique(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		lastUsed: integer('last_used', { mode: 'timestamp' }),
		revokedAt: integer('revoked_at', { mode: 'timestamp' }),
	},
	(t) => [index('tokens_token_idx').on(t.token)],
);

// region Relations

export const playersRelations = relations(players, ({ many, one }) => ({
	identifiers: many(playerIdentifiers),
	bans: many(bans),
	warns: many(warns),
	kicks: many(kicks),
	notes: many(playerNotes),
	reports: many(reports),
	adminProfile: one(adminUsers, {
		fields: [players.id],
		references: [adminUsers.playerId],
	}),
}));

export const adminUsersRelations = relations(adminUsers, ({ many, one }) => ({
	player: one(players, {
		fields: [adminUsers.playerId],
		references: [players.id],
	}),
	bans: many(bans),
	warns: many(warns),
	kicks: many(kicks),
	notes: many(playerNotes),
	sessions: many(sessions),
	auditLogs: many(auditLog),
	reportMessages: many(reportMessages),
	whitelists: many(whitelistedIdentifers),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
	admin: one(adminUsers, {
		fields: [auditLog.adminId],
		references: [adminUsers.id],
	}),
}));

export const playerIdentifiersRelations = relations(
	playerIdentifiers,
	({ one }) => ({
		player: one(players, {
			fields: [playerIdentifiers.playerId],
			references: [players.id],
		}),
	}),
);

export const bansRelations = relations(bans, ({ one }) => ({
	player: one(players, {
		fields: [bans.playerId],
		references: [players.id],
	}),
	issuer: one(adminUsers, {
		fields: [bans.issuer],
		references: [adminUsers.id],
	}),
}));

export const warnsRelations = relations(warns, ({ one }) => ({
	player: one(players, {
		fields: [warns.playerId],
		references: [players.id],
	}),
	issuer: one(adminUsers, {
		fields: [warns.issuer],
		references: [adminUsers.id],
	}),
}));

export const kicksRelations = relations(kicks, ({ one }) => ({
	player: one(players, {
		fields: [kicks.playerId],
		references: [players.id],
	}),
	issuer: one(adminUsers, {
		fields: [kicks.issuer],
		references: [adminUsers.id],
	}),
}));

export const playerNotesRelations = relations(playerNotes, ({ one }) => ({
	player: one(players, {
		fields: [playerNotes.playerId],
		references: [players.id],
	}),
	issuer: one(adminUsers, {
		fields: [playerNotes.issuer],
		references: [adminUsers.id],
	}),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
	player: one(players, {
		fields: [reports.reporterId],
		references: [players.id],
	}),
}));
