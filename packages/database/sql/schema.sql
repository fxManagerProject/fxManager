-- Dumping database structure for panel
CREATE DATABASE IF NOT EXISTS "panel";

-- Dumping structure for table panel.admin_users
CREATE TABLE
    IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        player_id TEXT REFERENCES players (id) ON DELETE SET NULL, -- links to players table
        created_at INTEGER NOT NULL,
        last_login_at INTEGER
    );

;

CREATE INDEX admin_username_idx ON admin_users (username);

-- Dumping structure for table panel.api_tokens
CREATE TABLE
    IF NOT EXISTS api_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        last_used INTEGER,
        revoked_at INTEGER
    );

;

CREATE INDEX tokens_token_idx ON api_tokens (token);

-- Dumping structure for table panel.audit_log
CREATE TABLE
    IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER,
        action TEXT NOT NULL,
        target TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL
    );

CREATE INDEX audit_admin_idx ON audit_log (admin_id);

CREATE INDEX audit_created_idx ON audit_log (created_at);

-- Dumping structure for table panel.bans
CREATE TABLE
    IF NOT EXISTS bans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL REFERENCES players (id),
        reason TEXT NOT NULL,
        banned_by TEXT NOT NULL,
        expires_at INTEGER,
        created_at INTEGER NOT NULL,
        revoked_at INTEGER
    );

CREATE INDEX bans_player_idx ON bans (player_id);

-- Dumping structure for table panel.kicks
CREATE TABLE
    IF NOT EXISTS `kicks` (
        `id` INTEGER PRIMARY KEY AUTOINCREMENT,
        `player_id` INTEGER NOT NULL,
        `reason` TEXT,
        `revoked` INTEGER NOT NULL DEFAULT 0, -- 0 active | 1 revoked / inactive
        `issuer` INTEGER NULL, -- null then system issued (i.e. banned via api)
        `issued_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
        FOREIGN KEY (`issuer`) REFERENCES `admins` (`id`) ON DELETE SET NULL
    );

-- Dumping structure for table panel.player_identifiers
CREATE TABLE
    IF NOT EXISTS `player_identifiers` (
        `id` INTEGER PRIMARY KEY AUTOINCREMENT,
        `player_id` INTEGER NOT NULL,
        `type` TEXT NOT NULL, -- as "license" | "license2" | "xbxl" | "discord" | "steam" | "live" | "fivem"
        `value` TEXT NOT NULL,
        FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
        UNIQUE (`type`, `value`)
    );

;

CREATE INDEX `idx_identifier_value` ON `player_identifiers` (`value`);

-- Dumping structure for table panel.player_notes
CREATE TABLE
    IF NOT EXISTS `player_notes` (
        `id` INTEGER PRIMARY KEY AUTOINCREMENT,
        `player_id` INTEGER NOT NULL,
        `content` TEXT,
        `issuer` INTEGER NULL, -- null then system issued (i.e. banned via api)
        `issued_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
        FOREIGN KEY (`issuer`) REFERENCES `admins` (`id`) ON DELETE SET NULL
    );

-- Dumping structure for table panel.players
CREATE TABLE
    IF NOT EXISTS `players` (
        `id` INTEGER PRIMARY KEY AUTOINCREMENT,
        `name` TEXT NOT NULL,
        `playtime` INTEGER NOT NULL DEFAULT 0, -- playtime in minutes
        `first_seen` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `last_seen` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

-- Dumping structure for table panel.report_messages
CREATE TABLE
    IF NOT EXISTS `report_messages` (
        `id` INTEGER PRIMARY KEY AUTOINCREMENT,
        `player_id` INTEGER NULL,
        `admin_id` INTEGER NULL,
        `message` TEXT NOT NULL,
        `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE SET NULL,
        FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`) ON DELETE SET NULL
    );

-- Dumping structure for table panel.reports
CREATE TABLE
    IF NOT EXISTS `reports` (
        `id` INTEGER PRIMARY KEY AUTOINCREMENT,
        `reporter_id` INTEGER NOT NULL,
        `subject` TEXT NOT NULL,
        `status` TEXT DEFAULT "open", -- states: "open" | "inprogress" | "resolved"
        `opened_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `last_action` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`reporter_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
    );

-- Dumping structure for table panel.schema_version
CREATE TABLE
    IF NOT EXISTS schema_version (
        version INTEGER NOT NULL,
        description TEXT NOT NULL,
        applied_at INTEGER NOT NULL
    );

-- Dumping structure for table panel.sessions
CREATE TABLE
    IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        admin_id INTEGER NOT NULL REFERENCES admin_users (id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
    );

CREATE INDEX sessions_admin_idx ON sessions (admin_id);

-- Dumping structure for table panel.settings
CREATE TABLE
    IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    );

-- Dumping structure for table panel.warns
CREATE TABLE
    IF NOT EXISTS `warns` (
        `id` INTEGER PRIMARY KEY AUTOINCREMENT,
        `player_id` INTEGER NOT NULL,
        `reason` TEXT,
        `read` INTEGER NOT NULL DEFAULT 0, -- 0 not ack'd | 1 ack'd by player (allows offline warns)
        `revoked` INTEGER NOT NULL DEFAULT 0, -- 0 active | 1 revoked / inactive
        `issuer` INTEGER NULL, -- null then system issued (i.e. banned via api)
        `issued_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
        FOREIGN KEY (`issuer`) REFERENCES `admins` (`id`) ON DELETE SET NULL
    );
