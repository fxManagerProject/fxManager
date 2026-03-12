import { Migration } from '../types';

export const migration_0001_initial: Migration = {
  version: 1,
  description: 'Initial schema',
  up: [
    // region core tables
    `CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      playtime INTEGER DEFAULT 0,
      first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER REFERENCES admin_users (id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      target TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL
    )`,

    `CREATE INDEX audit_admin_idx ON audit_log (admin_id)`,
    `CREATE INDEX audit_created_idx ON audit_log (created_at)`,

    // region auth tables

    `CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      player_id TEXT REFERENCES players (id) ON DELETE SET NULL,
      permissions INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_login_at INTEGER
    )`,

    `CREATE INDEX admin_username_idx ON admin_users (username)`,

    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL REFERENCES admin_users (id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`,

    `CREATE INDEX sessions_admin_idx ON sessions (admin_id)`,

    `CREATE TABLE IF NOT EXISTS api_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      last_used INTEGER,
      revoked_at INTEGER
    )`,

    `CREATE INDEX tokens_token_idx ON api_tokens (token)`,

    // region player data tables
    `CREATE TABLE IF NOT EXISTS player_identifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      value TEXT NOT NULL,
      FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
      UNIQUE (type, value)
    )`,

    `CREATE INDEX idx_identifier_value ON player_identifiers (value)`,

    `CREATE TABLE IF NOT EXISTS player_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      content TEXT,
      issuer INTEGER NULL,
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
      FOREIGN KEY (issuer) REFERENCES admin_users (id) ON DELETE SET NULL
    )`,

    // region punishment tables
    `CREATE TABLE IF NOT EXISTS bans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL REFERENCES players (id),
      reason TEXT NOT NULL,
      banned_by TEXT NOT NULL,
      expires_at INTEGER,
      created_at INTEGER NOT NULL,
      revoked_at INTEGER
    )`,

    `CREATE INDEX bans_player_idx ON bans (player_id)`,

    `CREATE TABLE IF NOT EXISTS warns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      reason TEXT,
      read INTEGER DEFAULT 0,
      revoked INTEGER DEFAULT 0,
      issuer INTEGER NULL,
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
      FOREIGN KEY (issuer) REFERENCES admin_users (id) ON DELETE SET NULL
    )`,

    `CREATE TABLE IF NOT EXISTS kicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      reason TEXT,
      revoked INTEGER DEFAULT 0,
      issuer INTEGER NULL,
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
      FOREIGN KEY (issuer) REFERENCES admin_users (id) ON DELETE SET NULL
    )`,

    // region report tables
    `CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      status TEXT DEFAULT "open",
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_action DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_id) REFERENCES players (id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS report_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NULL,
      admin_id INTEGER NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE SET NULL,
      FOREIGN KEY (admin_id) REFERENCES admin_users (id) ON DELETE SET NULL
    )`,

    // region system tables
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL,
      description TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )`,
  ],
};
