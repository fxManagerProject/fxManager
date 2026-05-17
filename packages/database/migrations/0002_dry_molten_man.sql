PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_whitelisted_identifiers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`admin_id` integer,
	`system` integer DEFAULT 0 NOT NULL,
	`added_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_whitelisted_identifiers`("id", "type", "value", "admin_id", "system", "added_at") SELECT "id", "type", "value", "admin_id", "system", "added_at" FROM `whitelisted_identifiers`;--> statement-breakpoint
DROP TABLE `whitelisted_identifiers`;--> statement-breakpoint
ALTER TABLE `__new_whitelisted_identifiers` RENAME TO `whitelisted_identifiers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_whitelist_identifier_value` ON `whitelisted_identifiers` (`value`);--> statement-breakpoint
CREATE UNIQUE INDEX `whitelisted_identifiers_type_value_unique` ON `whitelisted_identifiers` (`type`,`value`);
