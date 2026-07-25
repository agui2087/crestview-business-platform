CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text DEFAULT 'private-owner' NOT NULL,
	`opportunity_id` text,
	`storage_key` text NOT NULL,
	`original_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`category` text DEFAULT 'Other' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_storage_key_unique` ON `documents` (`storage_key`);