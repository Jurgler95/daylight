CREATE TABLE `health_days` (
	`date` text PRIMARY KEY NOT NULL,
	`steps` integer,
	`sleep_minutes` integer,
	`resting_hr` integer,
	`exercise_minutes` integer,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `settings` ADD `health_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `health_synced_from` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `health_last_sync_at` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `health_last_error` text;