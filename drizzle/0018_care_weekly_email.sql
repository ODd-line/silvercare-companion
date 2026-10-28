CREATE TABLE `care_email_challenges` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`requested_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `care_email_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`week_start` integer NOT NULL,
	`revision` integer NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_id` text,
	`created_at` integer NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`sent_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `care_email_user_week` ON `care_email_deliveries` (`user_id`,`week_start`);--> statement-breakpoint
CREATE INDEX `care_email_due` ON `care_email_deliveries` (`status`,`lease_until`);--> statement-breakpoint
CREATE INDEX `care_email_provider` ON `care_email_deliveries` (`provider_id`);--> statement-breakpoint
CREATE TABLE `care_email_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`email` text NOT NULL,
	`verified_at` integer,
	`sections` text DEFAULT '["checkins","heart","notes"]' NOT NULL,
	`unsubscribe_token` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `care_email_preferences_unsubscribe_token_unique` ON `care_email_preferences` (`unsubscribe_token`);