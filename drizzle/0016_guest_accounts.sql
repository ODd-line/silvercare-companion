ALTER TABLE `users` ADD `is_guest` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_guest_recovery` ON `users` (`recovery`) WHERE "users"."is_guest" = 1;