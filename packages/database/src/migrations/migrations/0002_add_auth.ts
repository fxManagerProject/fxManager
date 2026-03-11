import { Migration } from '../types';

export const migration_0002_auth: Migration = {
  version: 2,
  description: 'Admin users and sessions',
  up: [
    `CREATE TABLE admin_users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT    NOT NULL UNIQUE,
        password_hash TEXT    NOT NULL,
        player_id     TEXT             REFERENCES players (id) ON DELETE SET NULL, -- links to players table
        created_at    INTEGER NOT NULL,
        last_login_at INTEGER
      )`,
    `CREATE INDEX admin_username_idx ON admin_users (username)`,
    `CREATE TABLE sessions (
        id         TEXT    PRIMARY KEY,
        admin_id   INTEGER NOT NULL REFERENCES admin_users (id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )`,
    `CREATE INDEX sessions_admin_idx ON sessions (admin_id)`,
  ],
};
