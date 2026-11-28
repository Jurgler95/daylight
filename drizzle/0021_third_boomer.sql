ALTER TABLE `activity_groups` ADD `describes_mood` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `scales` ADD `describes_mood` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `activity_groups` SET `describes_mood` = 1 WHERE `name` IN ('Gefühle', 'Emotions', 'Emociones', 'Emoções', 'Émotions', 'Emozioni', 'Gevoelens', 'Emocje', 'Duygular', 'Perasaan');