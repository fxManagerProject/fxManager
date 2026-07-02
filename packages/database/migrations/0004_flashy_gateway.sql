CREATE TABLE `admin_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`permissions` integer DEFAULT 0 NOT NULL,
	`colour` text DEFAULT '#ffffff' NOT NULL,
	`icon` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_groups_name_unique` ON `admin_groups` (`name`);--> statement-breakpoint
CREATE TABLE `disconnect_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`ts` integer NOT NULL,
	`category` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `server_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `disconnect_event_session_ts_idx` ON `disconnect_events` (`session_id`,`ts`);--> statement-breakpoint
CREATE TABLE `perf_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`ts` integer NOT NULL,
	`players` integer DEFAULT 0 NOT NULL,
	`fxs_memory` integer,
	`node_memory` integer,
	`perf` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `server_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `perf_snapshot_session_ts_idx` ON `perf_snapshots` (`session_id`,`ts`);--> statement-breakpoint
CREATE TABLE `server_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`close_reason` text
);
--> statement-breakpoint
CREATE INDEX `server_session_started_idx` ON `server_sessions` (`started_at`);--> statement-breakpoint
ALTER TABLE `admin_users` ADD `group_id` integer REFERENCES admin_groups(id);