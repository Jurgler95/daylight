ALTER TABLE `settings` ADD `reminder_yesterday_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `reminder_yesterday_time` text DEFAULT '10:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `reminder_prompt_done` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `streak_celebrated` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `streak_rescue_dismissed` text;