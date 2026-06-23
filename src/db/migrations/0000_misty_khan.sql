CREATE TABLE `color` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text NOT NULL,
	`color_family_id` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`color_family_id`) REFERENCES `color_family`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `color_code_unique` ON `color` (`code`);--> statement-breakpoint
CREATE TABLE `color_family` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `color_family_code_unique` ON `color_family` (`code`);--> statement-breakpoint
CREATE TABLE `department` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `department_code_unique` ON `department` (`code`);--> statement-breakpoint
CREATE TABLE `model` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_code_unique` ON `model` (`code`);--> statement-breakpoint
CREATE TABLE `operation_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`operation_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`operator_id` text,
	`note` text,
	`occurred_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`operation_id`) REFERENCES `work_order_operation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `operation_transition` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_status` text NOT NULL,
	`event_type` text NOT NULL,
	`to_status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `routing_step` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`model_id` integer NOT NULL,
	`work_center_id` integer NOT NULL,
	`sequence` integer NOT NULL,
	`man_time_minutes` real DEFAULT 0 NOT NULL,
	`machine_time_minutes` real DEFAULT 0 NOT NULL,
	`setup_time_minutes` real DEFAULT 0 NOT NULL,
	`mco` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`model_id`) REFERENCES `model`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_center_id`) REFERENCES `work_center`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `work_center` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text NOT NULL,
	`department_id` integer NOT NULL,
	`capacity_per_shift` real DEFAULT 1 NOT NULL,
	`buffer_minutes` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`department_id`) REFERENCES `department`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_center_code_unique` ON `work_center` (`code`);--> statement-breakpoint
CREATE TABLE `work_order` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_number` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`scheduled_start` text,
	`scheduled_end` text,
	`released_at` text,
	`completed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_order_order_number_unique` ON `work_order` (`order_number`);--> statement-breakpoint
CREATE TABLE `work_order_line` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`model_id` integer NOT NULL,
	`color_id` integer,
	`quantity` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_order`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`model_id`) REFERENCES `model`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`color_id`) REFERENCES `color`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `work_order_operation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_line_id` integer NOT NULL,
	`work_center_id` integer NOT NULL,
	`routing_step_id` integer NOT NULL,
	`sequence` integer NOT NULL,
	`status` text DEFAULT 'QUEUED' NOT NULL,
	`scheduled_start` text,
	`scheduled_end` text,
	`started_at` text,
	`paused_at` text,
	`finished_at` text,
	`completed_at` text,
	`rejected_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`work_order_line_id`) REFERENCES `work_order_line`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_center_id`) REFERENCES `work_center`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`routing_step_id`) REFERENCES `routing_step`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- One sequence per model
CREATE UNIQUE INDEX `uq_routing_step_model_seq` ON `routing_step` (`model_id`, `sequence`);
--> statement-breakpoint
-- Makes applyEvent transition lookup deterministic
CREATE UNIQUE INDEX `uq_op_transition_from_event` ON `operation_transition` (`from_status`, `event_type`);
--> statement-breakpoint
-- Tablet queue: open ops per work center in sequence order (partial index = ix_op_open from CLAUDE.md)
CREATE INDEX `ix_op_open` ON `work_order_operation` (`work_center_id`, `sequence`) WHERE `status` IN ('QUEUED','IN_PROGRESS','PAUSED');
--> statement-breakpoint
-- Seed the state machine — the only source of truth for valid operation transitions
INSERT INTO `operation_transition` (`from_status`, `event_type`, `to_status`) VALUES
  ('QUEUED',      'START',  'IN_PROGRESS'),
  ('IN_PROGRESS', 'PAUSE',  'PAUSED'),
  ('IN_PROGRESS', 'FINISH', 'PENDING_QC'),
  ('PAUSED',      'RESUME', 'IN_PROGRESS'),
  ('PENDING_QC',  'ACCEPT', 'COMPLETED'),
  ('PENDING_QC',  'REJECT', 'REJECTED');
