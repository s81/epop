import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// --- Enums (TS unions; DB CHECK constraints live in the .sql migration) ---

export const WORK_ORDER_STATUSES = ['DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED'] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const OPERATION_STATUSES = [
  'QUEUED',
  'IN_PROGRESS',
  'PAUSED',
  'PENDING_QC',
  'COMPLETED',
  'REJECTED',
] as const;
export type OperationStatus = (typeof OPERATION_STATUSES)[number];

export const OPERATION_EVENT_TYPES = [
  'START',
  'PAUSE',
  'RESUME',
  'FINISH',
  'ACCEPT',
  'REJECT',
] as const;
export type OperationEventType = (typeof OPERATION_EVENT_TYPES)[number];

// --- Master data ---

export const department = sqliteTable('department', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

export const workCenter = sqliteTable('work_center', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  departmentId: integer('department_id')
    .notNull()
    .references(() => department.id),
  capacityPerShift: real('capacity_per_shift').notNull().default(1),
  bufferMinutes: integer('buffer_minutes').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

export const model = sqliteTable('model', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

export const colorFamily = sqliteTable('color_family', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

export const color = sqliteTable('color', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  colorFamilyId: integer('color_family_id')
    .notNull()
    .references(() => colorFamily.id),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

// --- Routing (ModelMachines + MCOs in legacy) ---

export const routingStep = sqliteTable('routing_step', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  modelId: integer('model_id')
    .notNull()
    .references(() => model.id, { onDelete: 'cascade' }),
  workCenterId: integer('work_center_id')
    .notNull()
    .references(() => workCenter.id),
  sequence: integer('sequence').notNull(),
  manTimeMinutes: real('man_time_minutes').notNull().default(0),
  machineTimeMinutes: real('machine_time_minutes').notNull().default(0),
  setupTimeMinutes: real('setup_time_minutes').notNull().default(0),
  mco: text('mco'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

// --- Production orders ---

export const workOrder = sqliteTable('work_order', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderNumber: text('order_number').notNull().unique(), // PO-YYYY-NNN, server-generated
  status: text('status', { enum: WORK_ORDER_STATUSES }).notNull().default('DRAFT'),
  scheduledStart: text('scheduled_start'),
  scheduledEnd: text('scheduled_end'),
  releasedAt: text('released_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

export const workOrderLine = sqliteTable('work_order_line', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workOrderId: integer('work_order_id')
    .notNull()
    .references(() => workOrder.id, { onDelete: 'cascade' }),
  modelId: integer('model_id')
    .notNull()
    .references(() => model.id),
  colorId: integer('color_id').references(() => color.id),
  quantity: integer('quantity').notNull().default(1),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

// MachineTransactions_Live equivalent — one row per (line × routing step)
export const workOrderOperation = sqliteTable('work_order_operation', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workOrderLineId: integer('work_order_line_id')
    .notNull()
    .references(() => workOrderLine.id, { onDelete: 'cascade' }),
  workCenterId: integer('work_center_id')
    .notNull()
    .references(() => workCenter.id),
  routingStepId: integer('routing_step_id')
    .notNull()
    .references(() => routingStep.id),
  sequence: integer('sequence').notNull(),
  status: text('status', { enum: OPERATION_STATUSES }).notNull().default('QUEUED'),
  scheduledStart: text('scheduled_start'),
  scheduledEnd: text('scheduled_end'),
  startedAt: text('started_at'),
  pausedAt: text('paused_at'),
  finishedAt: text('finished_at'),
  completedAt: text('completed_at'),
  rejectedAt: text('rejected_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

// MachineTransactionsLog_Live equivalent — append-only audit log + live feed
export const operationEvent = sqliteTable('operation_event', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  operationId: integer('operation_id')
    .notNull()
    .references(() => workOrderOperation.id, { onDelete: 'cascade' }),
  eventType: text('event_type', { enum: OPERATION_EVENT_TYPES }).notNull(),
  operatorId: text('operator_id'),
  note: text('note'),
  occurredAt: text('occurred_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

// Data-driven state machine — INSERT a row to add a transition, never if/else in code
export const operationTransition = sqliteTable('operation_transition', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fromStatus: text('from_status', { enum: OPERATION_STATUSES }).notNull(),
  eventType: text('event_type', { enum: OPERATION_EVENT_TYPES }).notNull(),
  toStatus: text('to_status', { enum: OPERATION_STATUSES }).notNull(),
});
