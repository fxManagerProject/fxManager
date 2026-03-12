import {
  sqliteTable,
  text,
  integer,
  index,
  unique,
  AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── Players ──────────────────────────────────────────────────────────────────

export const players = sqliteTable('players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  playtime: integer('playtime').default(0),
  firstSeen: integer('first_seen', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  lastSeen: integer('last_seen', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
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
  (t) => [index('idx_identifier_value').on(t.value), unique().on(t.type, t.value)],
);

// ─── Admin Users & Sessions ───────────────────────────────────────────────────

export const adminUsers = sqliteTable(
  'admin_users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    playerId: integer('player_id').references(() => players.id, { onDelete: 'set null' }),
    permissions: integer('permissions').notNull().default(0),
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

// ─── Punishments ──────────────────────────────────────────────────────────────

export const bans = sqliteTable(
  'bans',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    bannedBy: text('banned_by').notNull(),
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
  read: integer('read').default(0), // 0 not ack'd | 1 ack'd
  revoked: integer('revoked').default(0),
  issuer: integer('issuer').references(() => adminUsers.id, { onDelete: 'set null' }),
  issuedAt: integer('issued_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

export const kicks = sqliteTable('kicks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  playerId: integer('player_id')
    .notNull()
    .references(() => players.id, { onDelete: 'cascade' }),
  reason: text('reason'),
  revoked: integer('revoked').default(0),
  issuer: integer('issuer').references(() => adminUsers.id, { onDelete: 'set null' }),
  issuedAt: integer('issued_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// ─── Reports & Notes ──────────────────────────────────────────────────────────

export const reports = sqliteTable('reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reporterId: integer('reporter_id')
    .notNull()
    .references(() => players.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  status: text('status').default('open'), // open, inprogress, resolved
  openedAt: integer('opened_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  lastAction: integer('last_action', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

export const reportMessages = sqliteTable('report_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reportId: integer('report_id').references(() => reports.id, { onDelete: 'cascade' }),
  playerId: integer('player_id').references(() => players.id, { onDelete: 'set null' }),
  adminId: integer('admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  message: text('message').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

export const playerNotes = sqliteTable('player_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  playerId: integer('player_id')
    .notNull()
    .references(() => players.id, { onDelete: 'cascade' }),
  content: text('content'),
  issuer: integer('issuer').references(() => adminUsers.id, { onDelete: 'set null' }),
  issuedAt: integer('issued_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// ─── System ───────────────────────────────────────────────────────────────────

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    adminId: integer('admin_id').references(() => adminUsers.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    target: text('target'),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [index('audit_admin_idx').on(t.adminId), index('audit_created_idx').on(t.createdAt)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull().$type<unknown>(),
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
