CREATE TABLE `whitelisted_identifiers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`added` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`reason` text NOT NULL,
	`issuer` integer,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`issuer`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_bans`("id", "player_id", "reason", "issuer", "expires_at", "created_at", "revoked_at") SELECT "id", "player_id", "reason", "issuer", "expires_at", "created_at", "revoked_at" FROM `bans`;--> statement-breakpoint
DROP TABLE `bans`;--> statement-breakpoint
ALTER TABLE `__new_bans` RENAME TO `bans`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `bans_player_idx` ON `bans` (`player_id`);