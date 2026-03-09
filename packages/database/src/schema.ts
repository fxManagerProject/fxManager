import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// ─── Players ──────────────────────────────────────────────────────────────────

export const players = sqliteTable(
  'players',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    license: text('license').notNull().unique(),
    name: text('name').notNull(),
    firstSeen: integer('first_seen', { mode: 'timestamp' }).notNull(),
    lastSeen: integer('last_seen', { mode: 'timestamp' }).notNull(),
  },
  (t) => [index('players_license_idx').on(t.license)],
);

// ─── Bans ─────────────────────────────────────────────────────────────────────

export const bans = sqliteTable(
  'bans',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id),
    reason: text('reason').notNull(),
    bannedBy: text('banned_by').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  },
  (t) => [index('bans_player_idx').on(t.playerId)],
);

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    adminId: text('admin_id').notNull(),
    action: text('action').notNull(),
    target: text('target'),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [index('audit_admin_idx').on(t.adminId), index('audit_created_idx').on(t.createdAt)],
);

// ─── Settings ─────────────────────────────────────────────────────────────────

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull().$type<unknown>(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ─── API Tokens ───────────────────────────────────────────────────────────────

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

// ─── Admin Users ──────────────────────────────────────────────────────────────

export const adminUsers = sqliteTable(
  'admin_users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  },
  (t) => [index('admin_username_idx').on(t.username)],
);

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    adminId: integer('admin_id')
      .notNull()
      .references(() => adminUsers.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [index('sessions_admin_idx').on(t.adminId)],
);
