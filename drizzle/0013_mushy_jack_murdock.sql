ALTER TABLE `settings` ADD `outlook_notify_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `outlook_notify_time` text DEFAULT '08:00' NOT NULL;