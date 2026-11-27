CREATE TABLE `experiment_days` (
	`experiment_id` integer NOT NULL,
	`date` text NOT NULL,
	`kept` integer NOT NULL,
	PRIMARY KEY(`experiment_id`, `date`),
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`note` text,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`check_in` integer DEFAULT false NOT NULL,
	`result_seen` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
