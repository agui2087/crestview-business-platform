CREATE TABLE `profiles` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
