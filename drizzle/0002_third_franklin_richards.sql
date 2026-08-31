CREATE TABLE `document_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text,
	`owner_key` text NOT NULL,
	`action` text NOT NULL,
	`document_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `deal_name` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `fiscal_year` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL;