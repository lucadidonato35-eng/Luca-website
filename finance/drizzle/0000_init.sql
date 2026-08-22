CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`institution` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`currency` text NOT NULL,
	`external_id` text,
	`source_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fx_rates` (
	`date` text NOT NULL,
	`base` text NOT NULL,
	`quote` text NOT NULL,
	`rate` text NOT NULL,
	`source` text DEFAULT 'ecb' NOT NULL,
	`fetched_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fx_rates_pk` ON `fx_rates` (`date`,`base`,`quote`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`target_amount_minor` integer NOT NULL,
	`target_currency` text NOT NULL,
	`target_date` text NOT NULL,
	`priority` integer DEFAULT 1 NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `import_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`filename` text NOT NULL,
	`file_hash` text NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`rows_seen` integer DEFAULT 0 NOT NULL,
	`rows_inserted` integer DEFAULT 0 NOT NULL,
	`rows_duplicate` integer DEFAULT 0 NOT NULL,
	`warnings` text
);
--> statement-breakpoint
CREATE TABLE `instruments` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`isin` text,
	`name` text NOT NULL,
	`asset_class` text DEFAULT 'unknown' NOT NULL,
	`sector` text,
	`region` text,
	`currency` text NOT NULL,
	`underlying_exposure` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `instruments_ticker_idx` ON `instruments` (`ticker`);--> statement-breakpoint
CREATE TABLE `positions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`instrument_id` text NOT NULL,
	`quantity` text NOT NULL,
	`cost_basis_minor` integer,
	`cost_basis_currency` text,
	`market_value_minor` integer NOT NULL,
	`market_value_currency` text NOT NULL,
	`as_of` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `positions_account_instrument_asof_idx` ON `positions` (`account_id`,`instrument_id`,`as_of`);--> statement-breakpoint
CREATE INDEX `positions_as_of_idx` ON `positions` (`as_of`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`as_of` text NOT NULL,
	`value_minor` integer NOT NULL,
	`value_currency` text NOT NULL,
	`liquidity` text DEFAULT 'liquid' NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `snapshots_account_asof_idx` ON `snapshots` (`account_id`,`as_of`,`liquidity`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`instrument_id` text,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`amount_currency` text NOT NULL,
	`quantity` text,
	`description` text DEFAULT '' NOT NULL,
	`counterparty` text,
	`external_id` text,
	`source_id` text NOT NULL,
	`dedupe_hash` text NOT NULL,
	`import_id` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_id`) REFERENCES `import_logs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_dedupe_idx` ON `transactions` (`dedupe_hash`);--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_account_date_idx` ON `transactions` (`account_id`,`date`);