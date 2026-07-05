# Scheduler Design — e-pop MES
**Date:** 2026-07-05  
**Status:** Implemented

## Overview

Finite-capacity dispatch scheduler with shift-calendar awareness. Given released work orders with exploded operations (routing steps at specific work centers), assign each QUEUED operation a concrete `scheduledStart` / `scheduledEnd` respecting:

- Work-center parallelism (capacity per shift — multiple operations in parallel)
- Shift calendar (working days, start/end times, spill-over across days/weekends)
- Operation duration = setup + max(man, machine) + per-WC buffer

Operators see the schedule via the admin scheduler page with a Gantt chart. The tablet UI shows the queue ordered by planned sequence (schedule integration is a follow-up).

---

## Data Model

### `work_center` — extended

Existing columns `capacity_per_shift` and `buffer_minutes` drive the scheduler:

```ts
capacityPerShift: real('capacity_per_shift').notNull().default(1)
bufferMinutes: integer('buffer_minutes').notNull().default(0)
```

### `work_order_operation` — scheduling fields

Existing nullable columns used by the scheduler:

```ts
scheduledStart: text('scheduled_start')  // ISO-8601, set by scheduler
scheduledEnd:   text('scheduled_end')    // ISO-8601, set by scheduler
```

### `shift_calendar` — new table

```ts
shiftCalendar {
  id            integer  PK autoincrement
  date          text     unique, not null  // "2026-07-06"
  startTime     text     not null default '08:00'
  endTime       text     not null default '16:00'
  isWorkingDay  boolean  not null default true
  createdAt     text     ISO-8601, default now
}
```

Seed script generates 90 days of Sun–Thu shifts (Fri/Sat off), 08:00–16:00.

### `production_target` — new table

```ts
productionTarget {
  id              integer  PK autoincrement
  workCenterId    integer  FK → work_center.id
  date            text     not null  // "2026-07-06"
  targetQuantity  integer  not null
  createdAt       text     ISO-8601, default now
}
```

Admin UI shows a month grid: WC columns × day rows, target (top) / actual FINISH+ACCEPT count (bottom). Click to edit.

---

## Algorithm

### `clearSchedule(db)`

Set `scheduledStart = NULL, scheduledEnd = NULL` on all QUEUED operations that already have scheduled times. Returns count of cleared rows.

### `runScheduler(db)`

Returns `{ scheduled: number, errors: string[] }`.

Per work center (ordered by code):

1. Fetch all QUEUED operations with their routing-step durations via JOINs to `work_order_line`, `work_order`, `routing_step`.
2. Sort by `work_order.createdAt ASC, work_order_operation.sequence ASC` (FIFO per WC).
3. Create `N = capacityPerShift` parallel time slots, all starting at `now`.
4. For each operation:
   - Duration = `setupTimeMinutes + max(manTimeMinutes, machineTimeMinutes) + bufferMinutes`
   - Pick the earliest-available slot among the N slots.
   - Call `ShiftCalendar.getNextSlotStart(after)` to find the next working time ≥ the slot's current time (skips non-working days, jumps to shift start if before hours).
   - Call `ShiftCalendar.addDuration(start, durationMinutes)` to compute the end time, spilling across shift boundaries and weekends as needed.
   - Write `scheduledStart / scheduledEnd` to the DB.
   - Advance the slot's `nextAvailable` to the computed end time.

### `ShiftCalendar`

In-memory class loaded from `shift_calendar` rows:

- `getShiftForDate(date)`: returns `{ start: Date, end: Date }` or `null` for non-working days.
- `getNextSlotStart(after)`: returns the earliest working time ≥ `after`. If within a shift, returns the later of `after` and shift start. If after shift end, searches forward up to 365 days for the next working day's start.
- `addDuration(from, durationMinutes)`: adds duration in working-time chunks. Spills across days: if remaining duration > available shift time, consumes the available shift time and continues from the next working day.

Edge cases:
- Duration exactly fills a shift → end exactly at shift end time
- Operation requested at a non-working time → bumped to next shift start
- Multi-day duration (e.g., 15 hours across 2 shifts) → correctly split

---

## UI Components

### Scheduler Page (`/admin/scheduler`)

**Server component:**
- Fetches all operations with order, model, WC, status, schedule
- Fetches shift calendar for summary stats
- Passes `onRun` and `onClear` server actions to client

**Client component:**
- Summary: total ops, unscheduled count, shift hours, working/total days
- Run Scheduler button → calls `clearSchedule()` then `runScheduler()`
- Clear Schedule button → calls `clearSchedule()`
- Export CSV of scheduled operations
- Print / Print Labels buttons
- Gantt chart (when any operations are scheduled)
- Table grouped by work center: Order, Model, Seq, Qty, Status, Start, End

**Gantt chart:**
- Drag-to-reschedule on QUEUED operations (snaps to 15-min grid)
- Color-coded by model code
- Tooltip on hover: order number, model, seq, qty, status, start→end
- Day headers and hour ticks
- Print-optimized CSS (landscape, no-print elements hidden)
- Touch support for tablet use

### Shifts Page (`/admin/shifts`)

Monthly calendar of shift entries with month navigation:

- Table: Date, Day name, Working/Not, Start time, End time, Edit/Delete
- Add Shift modal (date, start, end, working-day checkbox)
- Edit Shift modal (pre-filled, same fields)
- Delete with confirmation

### Targets Page (`/admin/targets`)

Monthly grid view:

- Rows = days, Columns = work centers
- Each cell: target quantity (top, bold) / actual FINISH+ACCEPT count (bottom, gray)
- Click any cell → modal to set/edit target
- Month navigation (prev/next)

### Dashboard (`/admin`)

Updated with scheduler-aware KPIs:

- KPI cards: Work Orders count, In Progress count, Open Maintenance, Quality Defects, Today's Achievement %
- Operations by Status bar chart
- Work Center Load bars (queued / in-progress per WC)
- Recent Activity feed (last 10 operation events)

---

## Files

### New:
- `src/db/shifts.ts` — ShiftCalendar class
- `src/db/scheduler.ts` — clearSchedule, runScheduler
- `src/db/migrations/0004_shift_calendar.sql` — shift_calendar table DDL
- `src/db/migrations/0005_production_target.sql` — production_target table DDL
- `src/app/admin/scheduler/page.tsx` — server page
- `src/app/admin/scheduler/actions.ts` — runScheduleAction, clearScheduleAction, rescheduleOperation
- `src/app/admin/scheduler/client.tsx` — scheduler UI
- `src/app/admin/scheduler/gantt.tsx` — Gantt chart with drag-to-reschedule
- `src/app/admin/shifts/page.tsx` — shifts server page
- `src/app/admin/shifts/actions.ts` — upsertShift, deleteShift
- `src/app/admin/shifts/client.tsx` — shifts UI
- `src/app/admin/targets/page.tsx` — targets server page
- `src/app/admin/targets/actions.ts` — upsertTarget, deleteTarget
- `src/app/admin/targets/client.tsx` — targets UI

### Modified:
- `src/db/schema.ts` — add `RESTART` event type, `shiftCalendar` table, `productionTarget` table
- `src/db/migrations/meta/_journal.json` — add migration entries
- `src/app/admin/layout.tsx` — add nav links for Dashboard, Orders, Scheduler, Shifts, Targets, Audit, Labor, Reports
- `src/app/admin/page.tsx` — dashboard rewrite with scheduler integration

---

## Out of Scope

- Automatic schedule-trigger on work-order release (manual "Run Scheduler" for now)
- Real-time Gantt updates via WebSocket/SSE (re-render on page load / post-action)
- Machine-level scheduling within a work center (only WC-level parallelism)
- Constraint propagation (no backward scheduling; no material/resource constraints beyond capacity)
- Schedule comparison / what-if scenarios
