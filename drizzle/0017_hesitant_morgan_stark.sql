ALTER TABLE `settings` ADD `reminder_times` text DEFAULT '["20:30"]' NOT NULL;--> statement-breakpoint
UPDATE `settings` SET `reminder_times` = '["' || `reminder_time` || '"]';