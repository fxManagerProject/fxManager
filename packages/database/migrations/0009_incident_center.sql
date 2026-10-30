CREATE TABLE `incident_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` integer NOT NULL,
	`kind` text NOT NULL,
	`summary` text NOT NULL,
	`data` text NOT NULL,
	`bytes` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `incident_events_ts_idx` ON `incident_events` (`ts`,`id`);--> statement-breakpoint
CREATE TABLE `incident_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`incident_id` integer NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` integer,
	`bytes` integer NOT NULL,
	FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `incident_notes_incident_idx` ON `incident_notes` (`incident_id`);--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`from_ts` integer NOT NULL,
	`to_ts` integer NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` integer,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_at` integer,
	`evidence` text NOT NULL,
	`event_count` integer NOT NULL,
	`bytes` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `incidents_created_idx` ON `incidents` (`created_at`);