# Scheduler Implementation Plan (Phase 8)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement tasks. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add finite-capacity dispatch scheduling with shift-calendar awareness and production-target tracking.

**Architecture:** Greedy per-WC scheduler using capacity-per-shift parallelism. ShiftCalendar class loads working-day entries from DB and handles time arithmetic (shift boundaries, weekend spill-over). Admin UI: scheduler page with Gantt chart, shifts CRUD, targets month-grid, and dashboard KPIs.

**Tech Stack:** Next.js 15 App Router · Drizzle ORM · libSQL · Vitest

## Global Constraints

- All ISO-8601 timestamps stored as TEXT in UTC (matches existing convention)
- Drizzle table definitions in `src/db/schema.ts`; raw DDL in `src/db/migrations/`
- Migration files: 0004 (shift_calendar), 0005 (production_target)
- Server actions start with `'use server'` and return `{ error: string } | { success: true } | { success: true; eventType: string }`
- Bilingual labels on all UI: Arabic / English
- Tests use `file::memory:?cache=shared` in-memory libSQL, run required migrations in `beforeAll`
- Auth guarded by `requireRole('DATA_ENTRY')` on all mutating actions; `requireRole('ADMIN')` on shifts/targets upsert

---

## File Map

**New:**
- `src/db/shifts.ts` — ShiftCalendar class
- `src/db/scheduler.ts` — clearSchedule, runScheduler
- `src/db/__tests__/shifts.test.ts` — ShiftCalendar unit tests
- `src/db/__tests__/scheduler.test.ts` — scheduler integration tests
- `src/db/migrations/0004_shift_calendar.sql`
- `src/db/migrations/0005_production_target.sql`
- `src/app/admin/scheduler/page.tsx` — server page
- `src/app/admin/scheduler/actions.ts` — server actions
- `src/app/admin/scheduler/client.tsx` — client component
- `src/app/admin/scheduler/gantt.tsx` — Gantt chart
- `src/app/admin/shifts/page.tsx`
- `src/app/admin/shifts/actions.ts`
- `src/app/admin/shifts/client.tsx`
- `src/app/admin/targets/page.tsx`
- `src/app/admin/targets/actions.ts`
- `src/app/admin/targets/client.tsx`

**Modified:**
- `src/db/schema.ts` — add shiftCalendar + productionTarget tables + RESTART event type
- `src/db/migrations/meta/_journal.json` — add migration 0005 entry
- `src/app/admin/layout.tsx` — add nav links for scheduler/shifts/targets/audit/labor/reports
- `src/app/admin/page.tsx` — dashboard rewrite with scheduler KPIs
- `scripts/seed.ts` — comprehensive demo seed with shift calendar + scheduler execution

---

### Task 1: ShiftCalendar class + unit tests

**Files:**
- Create: `src/db/shifts.ts`
- Create: `src/db/__tests__/shifts.test.ts`

**Interfaces:**
- Produces: `ShiftCalendar` class with `getShiftForDate`, `getNextSlotStart`, `addDuration`

- [ ] **Step 1: Write failing tests**

Create `src/db/__tests__/shifts.test.ts` with test data spanning working days (Mon–Thu), a weekend (Fri–Sat), and the following week. Test cases:

1. Constructor stores working days, skips non-working days
2. `getShiftForDate` returns correct start/end times for a working day
3. `getShiftForDate` returns null for non-working day
4. `getNextSlotStart` returns same time if within working hours
5. `getNextSlotStart` returns shift start if before hours
6. `getNextSlotStart` returns next working day if after shift end
7. `getNextSlotStart` skips weekend (Thu 17:00 → Sun 08:00)
8. `addDuration` stays within same shift when duration fits
9. `addDuration` spills to next day when duration exceeds remaining shift time
10. `addDuration` spills across weekend
11. `addDuration` handles duration exactly filling remaining shift
12. `addDuration` spills when starting past shift end
13. `addDuration` spans multiple days for long durations

- [ ] **Step 2: Implement ShiftCalendar**

```ts
export class ShiftCalendar {
  private shifts: Map<string, { start: string; end: string }>;

  constructor(entries: ShiftRow[]): stores working days by date key

  static async load(db): Promise<ShiftCalendar>: fetches all shift_calendar rows ordered by date

  getShiftForDate(date: Date): { start: Date; end: Date } | null

  getNextSlotStart(after: Date): Date:
    - If after falls within a shift, return max(after, shift.start) if < shift.end
    - Otherwise search forward up to 365 days for the next working day's start

  addDuration(from: Date, durationMinutes: number): Date:
    - Remaining = durationMinutes, current = from
    - While remaining > 0:
      - Get shift for current date
      - If no shift or past shift end → advance to next slot start (continue)
      - Available = (shift.end - current) in minutes
      - If available >= remaining → return current + remaining
      - Otherwise remaining -= available, current = shift.end + 1s
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
npx vitest run src/db/__tests__/shifts.test.ts
```

Expected: `15 tests passed`.

- [ ] **Step 4: Commit**

```bash
git add src/db/shifts.ts src/db/__tests__/shifts.test.ts
git commit -m "feat: add ShiftCalendar with working-day boundary handling"
```

---

### Task 2: Scheduler core — clearSchedule + runScheduler

**Files:**
- Create: `src/db/scheduler.ts`
- Create: `src/db/__tests__/scheduler.test.ts`

**Interfaces:**
- Consumes: `ShiftCalendar` from `@/db/shifts`; tables from `@/db/schema`
- Produces: `clearSchedule(db)`, `runScheduler(db)`

- [ ] **Step 1: Write failing tests**

Create `src/db/__tests__/scheduler.test.ts`. Seed infrastructure: `seedShifts()` (45 days Sun–Thu), `seedBase()` (dept, WC, model, routing step, work order, line), `createOp()`.

Test cases:

1. `clearSchedule` clears existing scheduled times from QUEUED operations
2. `clearSchedule` does nothing if no QUEUED ops have scheduled times
3. Single QUEUED operation gets scheduled within working hours
4. Multiple operations schedule within working hours on working days only
5. `capacityPerShift` allows parallel operations (same start time for capacity=2)
6. Buffer minutes are included in duration
7. Non-QUEUED operations are skipped
8. Empty work center produces no errors

- [ ] **Step 2: Implement clearSchedule**

```ts
export async function clearSchedule(db): Promise<number>:
  SELECT ids of QUEUED ops with non-null scheduledStart
  UPDATE SET scheduledStart=null, scheduledEnd=null WHERE id IN (...ids)
  RETURN count
```

- [ ] **Step 3: Implement runScheduler**

```ts
export async function runScheduler(db): Promise<{ scheduled: number; errors: string[] }>:
  now = new Date()
  shiftCalendar = await ShiftCalendar.load(db)
  centers = SELECT id, code, capacityPerShift, bufferMinutes FROM workCenter ORDER BY code

  for each wc in centers:
    operations = SELECT op.id, sequence, setupTimeMinutes, manTimeMinutes, 
                  machineTimeMinutes, createdAt
                FROM workOrderOperation
                JOIN workOrderLine, workOrder, routingStep
                WHERE wc.id AND status='QUEUED'
                ORDER BY createdAt ASC, sequence ASC

    capacity = max(1, floor(capacityPerShift))
    slots = array of N slots initialized to now

    for each op in operations:
      durationMinutes = setup + max(man, machine) + bufferMinutes
      earliest = slots.min(nextAvailable)
      start = shiftCalendar.getNextSlotStart(earliest.nextAvailable)
      end = shiftCalendar.addDuration(start, durationMinutes)
      UPDATE workOrderOperation SET scheduledStart, scheduledEnd WHERE id = op.id
      earliest.nextAvailable = end
      scheduled++
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/db/__tests__/scheduler.test.ts
```

Expected: `8 tests passed`.

- [ ] **Step 5: Commit**

```bash
git add src/db/scheduler.ts src/db/__tests__/scheduler.test.ts
git commit -m "feat: add finite-capacity scheduler with shift awareness"
```

---

### Task 3: Shift calendar + production target schema + migrations

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/db/migrations/0004_shift_calendar.sql`
- Create: `src/db/migrations/0005_production_target.sql`
- Modify: `src/db/migrations/meta/_journal.json`

- [ ] **Step 1: Add tables to schema.ts**

```ts
// --- Shift Calendar ---
export const shiftCalendar = sqliteTable('shift_calendar', { ... });

// --- Production Targets ---
export const productionTarget = sqliteTable('production_target', { ... });
```

Also add `'RESTART'` to `OPERATION_EVENT_TYPES` array.

- [ ] **Step 2: Create 0004_shift_calendar.sql**

```sql
CREATE TABLE shift_calendar (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  date           TEXT NOT NULL UNIQUE,
  start_time     TEXT NOT NULL DEFAULT '08:00',
  end_time       TEXT NOT NULL DEFAULT '16:00',
  is_working_day INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

- [ ] **Step 3: Create 0005_production_target.sql**

```sql
CREATE TABLE production_target (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  work_center_id   INTEGER NOT NULL REFERENCES work_center(id),
  date             TEXT NOT NULL,
  target_quantity  INTEGER NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

- [ ] **Step 4: Update _journal.json**

Add entry for migration 0005 with `idx: 5`.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/migrations/
git commit -m "feat: add shift_calendar and production_target schema + migrations"
```

---

### Task 4: Admin scheduler page (server + client + actions + Gantt)

**Files:**
- Create: `src/app/admin/scheduler/page.tsx`
- Create: `src/app/admin/scheduler/actions.ts`
- Create: `src/app/admin/scheduler/client.tsx`
- Create: `src/app/admin/scheduler/gantt.tsx`

- [ ] **Step 1: Implement server actions**

```ts
// actions.ts
'use server';
export async function runScheduleAction():
  requireRole('DATA_ENTRY')
  cleared = clearSchedule()
  result = runScheduler()
  revalidatePath('/admin/scheduler')
  return { scheduled, cleared, errors }

export async function clearScheduleAction():
  requireRole('DATA_ENTRY')
  cleared = clearSchedule()
  revalidatePath('/admin/scheduler')
  return { cleared }

export async function rescheduleOperation(operationId, newStart, newEnd):
  requireRole('DATA_ENTRY')
  validate operation exists and is QUEUED
  update scheduledStart/scheduledEnd
  revalidatePath('/admin/scheduler')
  return { success: true }
```

- [ ] **Step 2: Implement server page**

Fetch all operations JOINed with order, model, WC. Fetch shifts for summary stats. Render `<SchedulerClient>` with data, shiftSummary, onRun, onClear.

- [ ] **Step 3: Implement client component**

- Header: title, summary line (n ops, n unscheduled, shift hours), action buttons
  - Export CSV button
  - Print button
  - Print Labels button (barcode labels per operation)
  - Clear Schedule form button
  - Run Scheduler form button (with loading state)
- Status message banner (success/error/info)
- Gantt chart (if any ops have scheduled times)
- Table grouped by work center: Order, Model, Seq, Qty, Status badge, Start, End

Helper: `groupBy(ops, 'workCenterCode')`, `formatTime(iso)`.

- [ ] **Step 4: Implement Gantt chart**

Horizontal timeline with WC rows, draggable bars:

- Fixed-left WC label column (84px), scrollable timeline
- Day headers + hour ticks
- Bars color-coded by model code (6 colors for known models, gray fallback)
- Drag-to-reschedule on QUEUED ops (mouse + touch)
  - Snap to 15-minute grid
  - On mouseup/touchend: call `rescheduleOperation` server action
- Tooltip on hover: order number, model, seq, qty, status, start→end
- Print styles: landscape, no-print hidden, bars with black borders

- [ ] **Step 5: Smoke test in browser**

Start dev server, navigate to `/admin/scheduler`. If no data, run seed: `npx tsx scripts/seed.ts`. Confirm:
- Page loads with operation table (grouped by WC)
- Run Scheduler button schedules operations
- Gantt chart appears with draggable bars
- Clear Schedule removes scheduled times
- CSV export produces downloadable file

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/scheduler/
git commit -m "feat: add admin scheduler page with Gantt chart, export, labels"
```

---

### Task 5: Shifts admin page

**Files:**
- Create: `src/app/admin/shifts/page.tsx`
- Create: `src/app/admin/shifts/actions.ts`
- Create: `src/app/admin/shifts/client.tsx`

- [ ] **Step 1: Implement server actions**

```ts
upsertShift(prev, formData): upsertShift
  requireRole('ADMIN')
  Validate date, startTime, endTime (start < end)
  INSERT ON CONFLICT(date) DO UPDATE

deleteShift(formData): deleteShift
  requireRole('ADMIN')
  DELETE WHERE date = formData.date
```

- [ ] **Step 2: Implement server page**

Read `month` from searchParams (default to current). Query shifts WHERE date LIKE `${month}-%` ORDER BY date. Render `<ShiftsClient>`.

- [ ] **Step 3: Implement client component**

- Month navigation (prev/next links with month query param)
- "Add Shift" button → opens modal with form
- Table: Date, Day name, Working/Not badge, Start time, End time, Edit/Delete
- Edit opens same modal pre-filled
- Delete with confirm dialog
- Empty state: "No shifts for this month"

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/shifts/
git commit -m "feat: add shift calendar admin CRUD page"
```

---

### Task 6: Production targets admin page

**Files:**
- Create: `src/app/admin/targets/page.tsx`
- Create: `src/app/admin/targets/actions.ts`
- Create: `src/app/admin/targets/client.tsx`

- [ ] **Step 1: Implement server actions**

```ts
upsertTarget(prev, formData):
  requireRole('ADMIN')
  Validate workCenterId, date, targetQuantity >= 0
  Upsert (INSERT or UPDATE matching workCenterId+date)

deleteTarget(prev, formData):
  requireRole('ADMIN')
  DELETE productionTarget WHERE id = ...
```

- [ ] **Step 2: Implement server page**

Read `month` from searchParams. Compute days array for the month.
Query:
- All work centers
- Production targets for the month
- Operation events (FINISH/ACCEPT) grouped by date + WC for actual counts
Build targetMap and actualMap. Render `<TargetsClient>`.

- [ ] **Step 3: Implement client component**

- Month navigation (prev/next)
- Grid: rows = days (numbered + weekday abbreviation), columns = work centers
- Each cell: target quantity (bold) / actual count (gray)
- Click cell → modal to set target
- Empty state handled inline

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/targets/
git commit -m "feat: add production targets admin page with monthly grid"
```

---

### Task 7: Dashboard + layout + seed

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `scripts/seed.ts`

- [ ] **Step 1: Update admin layout**

Add nav links for Dashboard, Orders, Scheduler, Shifts, Targets, Audit, Labor, Reports.
Add NotificationBar component. Add `no-print` class to sidebar.

- [ ] **Step 2: Rewrite dashboard page**

KPI cards (5-column grid):
- Work Orders (total count, links to /admin/orders)
- In Progress (count, links to /tablet)
- Open Maintenance (count, links to /admin/maintenance)
- Quality Defects (count, links to /admin/quality)
- Today's Achievement % (actual/target × 100, color-coded: ≥80% green, ≥50% amber, <50% red)

Charts:
- Operations by Status bar (QUEUED, IN_PROGRESS, PAUSED, PENDING_QC, COMPLETED, REJECTED)
- Work Center Load (queued + in-progress per WC)

Activity feed:
- Last 10 operation events with time, type badge, and note

- [ ] **Step 3: Rewrite seed script**

Comprehensive demo data:
- 5 departments: FAB, FIN, ASM, PKG
- 8 work centers with capacities and buffers
- 5 models (DESK-01, DESK-02, CHAR-01, CHAR-02, CAB-01)
- 3 color families + 6 colors
- 17 routing steps across models
- 3 users (admin, operator, viewer)
- 2 work orders with multiple lines, released
- Simulated operation START events on 3 operations
- 90 days of shift calendar (Sun–Thu 08:00–16:00)
- Run clearSchedule + runScheduler

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/page.tsx scripts/seed.ts
git commit -m "feat: update dashboard with scheduler KPIs, admin nav, and comprehensive seed"
```

---

### Task 8: Final integration — stage + commit all remainders

- [ ] **Step 1: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: no errors. (Drizzle-specific unused variable warnings are OK.)

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Stage all remaining files**

```bash
git add .
```

- [ ] **Step 4: Create final commit**

```bash
git commit -m "feat: Phase 8 finite-capacity scheduler + admin overhaul + tablet enhancements"
```
