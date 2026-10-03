ALTER TABLE `health_days` ADD `restored` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `health_in_backup` integer DEFAULT false NOT NULL;