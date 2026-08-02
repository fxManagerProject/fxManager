ALTER TABLE `admin_users` ADD `cfx_id` text;--> statement-breakpoint
ALTER TABLE `admin_users` ADD `discord_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_cfx_id_unique` ON `admin_users` (`cfx_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_discord_id_unique` ON `admin_users` (`discord_id`);--> statement-breakpoint
CREATE INDEX `admin_cfx_id_idx` ON `admin_users` (`cfx_id`);--> statement-breakpoint
CREATE INDEX `admin_discord_id_idx` ON `admin_users` (`discord_id`);