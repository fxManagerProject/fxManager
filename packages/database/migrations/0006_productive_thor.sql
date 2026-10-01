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
ALTER TABLE `admin_users` ADD `group_id` integer REFERENCES admin_groups(id);