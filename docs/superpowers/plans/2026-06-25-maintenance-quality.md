# Maintenance & Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add maintenance-request capture (tablet button + admin list) and quality-defect capture (reject modal + admin list) to the e-pop MES.

**Architecture:** Two new SQLite tables (`maintenance_request`, `quality_defect`) hang off the existing FSM. The tablet gains a persistent maintenance button (always visible, opens a modal) and changes the Reject button to open a category-select modal before firing. Two new read-only-ish admin pages give supervisors visibility. The only change to core operations logic is extending `applyEvent` to return the inserted `eventId` so `rejectWithDefectAction` can reference it.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, libSQL/SQLite, Vitest, React 19 (`useTransition` for direct server-action calls from client components), Tailwind CSS.

## Global Constraints

- All bilingual labels: Arabic first, then `/ English` — matches existing tablet pattern
- RTL layout: `dir="rtl"` on tablet pages — already set; don't remove it
- No auth gating — deferred per CLAUDE.md
- `PRAGMA foreign_keys = ON` is set in `db.ts`; migrations must respect FK order
- Test DB URL: `file:mq_test?mode=memory&cache=shared` — distinct from `release.test.ts`'s `file::memory:?cache=shared`
- No `.returning()` call unless the returned ID is needed — prefer minimal surface
- Drizzle nullable columns: pass `null` explicitly (not `undefined`) for clarity
- Commit after every task

---

## File Map

**New files:**
- `src/db/migrations/0001_maintenance_quality.sql` — DDL for both new tables
- `src/db/__tests__/maintenance-quality.test.ts` — Vitest: applyEvent eventId + table smoke
- `src/app/tablet/[workCenterId]/ConfirmModal.tsx` — shared modal overlay (client component)
- `src/app/admin/maintenance/page.tsx` — server component, fetches requests
- `src/app/admin/maintenance/client.tsx` — client component, filter + table + resolve
- `src/app/admin/maintenance/actions.ts` — `resolveMaintenanceAction`
- `src/app/admin/quality/page.tsx` — server component, read-only defect list

**Modified files:**
- `src/db/schema.ts` — 3 enums + 2 Drizzle tables
- `src/db/operations.ts` — `applyEvent`: add `dbInstance` param + `eventId` return
- `src/app/tablet/[workCenterId]/actions.ts` — add `reportMaintenanceAction`, `rejectWithDefectAction`
- `src/app/tablet/[workCenterId]/client.tsx` — modal state, maintenance button, reject modal flow
- `src/app/tablet/[workCenterId]/page.tsx` — pass new action props
- `src/app/admin/layout.tsx` — add Maintenance + Quality nav links

---

## Task 1: Schema additions + migration

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/db/migrations/0001_maintenance_quality.sql`

**Interfaces:**
- Produces:
  - `maintenanceRequest` Drizzle table (used in Tasks 3, 6)
  - `qualityDefect` Drizzle table (used in Tasks 3, 7)
  - `MaintenanceCategory` type (used in Tasks 3, 6)
  - `MaintenanceStatus` type (used in Task 6)
  - `QualityDefectCategory` type (used in Tasks 3, 7)

- [ ] **Step 1: Add enums and tables to `src/db/schema.ts`**

Append after the `operationTransition` table definition:

```ts
// --- Maintenance & Quality ---

export const MAINTENANCE_CATEGORIES = ['MECHANICAL', 'ELECTRICAL', 'TOOLING', 'OTHER'] as const;
export type MaintenanceCategory = (typeof MAINTENANCE_CATEGORIES)[number];

export const MAINTENANCE_STATUSES = ['OPEN', 'RESOLVED'] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const QUALITY_DEFECT_CATEGORIES = ['DIMENSIONAL', 'SURFACE', 'ASSEMBLY', 'OTHER'] as const;
export type QualityDefectCategory = (typeof QUALITY_DEFECT_CATEGORIES)[number];

export const maintenanceRequest = sqliteTable('maintenance_request', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workCenterId: integer('work_center_id')
    .notNull()
    .references(() => workCenter.id),
  operationId: integer('operation_id')
    .references(() => workOrderOperation.id),
  category: text('category', { enum: MAINTENANCE_CATEGORIES }).notNull(),
  note: text('note'),
  reportedBy: text('reported_by').notNull(),
  status: text('status', { enum: MAINTENANCE_STATUSES }).notNull().default('OPEN'),
  resolvedAt: text('resolved_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

export const qualityDefect = sqliteTable('quality_defect', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  operationId: integer('operation_id')
    .notNull()
    .references(() => workOrderOperation.id),
  operationEventId: integer('operation_event_id')
    .notNull()
    .references(() => operationEvent.id),
  category: text('category', { enum: QUALITY_DEFECT_CATEGORIES }).notNull(),
  reportedBy: text('reported_by').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});
```

- [ ] **Step 2: Create `src/db/migrations/0001_maintenance_quality.sql`**

```sql
CREATE TABLE maintenance_request (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  work_center_id INTEGER NOT NULL REFERENCES work_center(id),
  operation_id   INTEGER REFERENCES work_order_operation(id),
  category       TEXT NOT NULL CHECK (category IN ('MECHANICAL','ELECTRICAL','TOOLING','OTHER')),
  note           TEXT,
  reported_by    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')),
  resolved_at    TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE quality_defect (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id       INTEGER NOT NULL REFERENCES work_order_operation(id),
  operation_event_id INTEGER NOT NULL REFERENCES operation_event(id),
  category           TEXT NOT NULL CHECK (category IN ('DIMENSIONAL','SURFACE','ASSEMBLY','OTHER')),
  reported_by        TEXT NOT NULL,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

- [ ] **Step 3: Apply migration to local dev database**

```bash
sqlite3 local.db < src/db/migrations/0001_maintenance_quality.sql
```

Expected: no output, exit 0. If `local.db` doesn't exist yet, run `npx tsx scripts/seed.ts` first (which creates it via the db connection).

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/migrations/0001_maintenance_quality.sql
git commit -m "feat: add maintenance_request and quality_defect schema + migration"
```

---

## Task 2: Extend `applyEvent` — add `dbInstance` param and `eventId` return

**Files:**
- Modify: `src/db/operations.ts`
- Create: `src/db/__tests__/maintenance-quality.test.ts`

**Interfaces:**
- Consumes: `maintenanceRequest`, `qualityDefect` tables from Task 1 (migration must be applied)
- Produces:
  - `applyEvent(operationId, event, opts?, dbInstance?)` → `Promise<{ toStatus: OperationStatus; eventId: number }>`

- [ ] **Step 1: Write the failing test**

Create `src/db/__tests__/maintenance-quality.test.ts`:

```ts
import { beforeAll, afterEach, describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/db/schema';
import { applyEvent } from '@/db/operations';
import fs from 'fs';
import path from 'path';

const testClient = createClient({ url: 'file:mq_test?mode=memory&cache=shared' });
const testDb = drizzle(testClient, { schema });

beforeAll(async () => {
  await testClient.execute('PRAGMA foreign_keys = ON');
  for (const file of ['0000_misty_khan.sql', '0001_maintenance_quality.sql']) {
    const sql = fs.readFileSync(path.resolve(process.cwd(), `src/db/migrations/${file}`), 'utf-8');
    await testClient.executeMultiple(sql);
  }
});

afterEach(async () => {
  await testDb.delete(schema.qualityDefect);
  await testDb.delete(schema.maintenanceRequest);
  await testDb.delete(schema.operationEvent);
  await testDb.delete(schema.workOrderOperation);
  await testDb.delete(schema.workOrderLine);
  await testDb.delete(schema.workOrder);
  await testDb.delete(schema.routingStep);
  await testDb.delete(schema.workCenter);
  await testDb.delete(schema.model);
  await testDb.delete(schema.department);
});

async function seedBase() {
  const [dept] = await testDb
    .insert(schema.department)
    .values({ code: 'PROD', nameAr: 'إنتاج', nameEn: 'Production' })
    .returning({ id: schema.department.id });

  const [wc] = await testDb
    .insert(schema.workCenter)
    .values({ code: 'CUT', nameAr: 'قطع', nameEn: 'Cutting', departmentId: dept.id })
    .returning({ id: schema.workCenter.id });

  const [mdl] = await testDb
    .insert(schema.model)
    .values({ code: 'MDL-A', nameAr: 'نموذج أ', nameEn: 'Model A' })
    .returning({ id: schema.model.id });

  const [step] = await testDb
    .insert(schema.routingStep)
    .values({ modelId: mdl.id, workCenterId: wc.id, sequence: 10 })
    .returning({ id: schema.routingStep.id });

  const [wo] = await testDb
    .insert(schema.workOrder)
    .values({ orderNumber: 'PO-MQ-001', status: 'RELEASED' })
    .returning({ id: schema.workOrder.id });

  const [line] = await testDb
    .insert(schema.workOrderLine)
    .values({ workOrderId: wo.id, modelId: mdl.id, quantity: 1 })
    .returning({ id: schema.workOrderLine.id });

  const [op] = await testDb
    .insert(schema.workOrderOperation)
    .values({
      workOrderLineId: line.id,
      workCenterId: wc.id,
      routingStepId: step.id,
      sequence: 10,
      status: 'QUEUED',
    })
    .returning({ id: schema.workOrderOperation.id });

  return { dept, wc, mdl, step, wo, line, op };
}

describe('applyEvent', () => {
  it('returns eventId matching the inserted operation_event row', async () => {
    const { op } = await seedBase();

    const result = await applyEvent(op.id, 'START', {}, testDb);

    expect(result.toStatus).toBe('IN_PROGRESS');
    expect(typeof result.eventId).toBe('number');
    expect(result.eventId).toBeGreaterThan(0);

    const [event] = await testDb
      .select()
      .from(schema.operationEvent)
      .where(eq(schema.operationEvent.id, result.eventId));

    expect(event.eventType).toBe('START');
    expect(event.operationId).toBe(op.id);
  });

  it('quality_defect can reference the returned eventId', async () => {
    const { op, wc } = await seedBase();

    // START → IN_PROGRESS
    await applyEvent(op.id, 'START', {}, testDb);
    // FINISH → PENDING_QC
    await applyEvent(op.id, 'FINISH', {}, testDb);
    // REJECT → REJECTED
    const { eventId } = await applyEvent(op.id, 'REJECT', { operatorId: 'op-42' }, testDb);

    const [defect] = await testDb
      .insert(schema.qualityDefect)
      .values({
        operationId: op.id,
        operationEventId: eventId,
        category: 'DIMENSIONAL',
        reportedBy: 'op-42',
      })
      .returning();

    expect(defect.category).toBe('DIMENSIONAL');
    expect(defect.operationEventId).toBe(eventId);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run src/db/__tests__/maintenance-quality.test.ts
```

Expected: FAIL — `applyEvent` signature mismatch (no `dbInstance` param, missing `eventId` in return).

- [ ] **Step 3: Update `src/db/operations.ts`**

Change the `applyEvent` signature and internals. Full new version of the function (replace the existing `applyEvent` function entirely):

```ts
export async function applyEvent(
  operationId: number,
  event: OperationEventType,
  opts?: { operatorId?: string; note?: string },
  dbInstance: typeof db = db,
): Promise<{ toStatus: OperationStatus; eventId: number }> {
  return dbInstance.transaction(async (tx) => {
    const [op] = await tx
      .select({ status: workOrderOperation.status })
      .from(workOrderOperation)
      .where(eq(workOrderOperation.id, operationId));

    if (!op) throw new Error(`Operation ${operationId} not found`);

    const fromStatus = op.status;

    const [transition] = await tx
      .select({ toStatus: operationTransition.toStatus })
      .from(operationTransition)
      .where(
        and(
          eq(operationTransition.fromStatus, fromStatus),
          eq(operationTransition.eventType, event),
        ),
      );

    if (!transition) throw new IllegalTransition(fromStatus, event);

    const toStatus = transition.toStatus;
    const now = new Date().toISOString();

    const [{ eventId }] = await tx
      .insert(operationEvent)
      .values({
        operationId,
        eventType: event,
        operatorId: opts?.operatorId,
        note: opts?.note,
        occurredAt: now,
      })
      .returning({ eventId: operationEvent.id });

    const timestamp = timestampForStatus(toStatus, now);
    await tx
      .update(workOrderOperation)
      .set({ status: toStatus, ...timestamp })
      .where(eq(workOrderOperation.id, operationId));

    return { toStatus, eventId };
  });
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/db/__tests__/maintenance-quality.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Run full test suite to verify no regressions**

```bash
npx vitest run
```

Expected: all tests pass (the existing `release.test.ts` tests plus the 2 new ones).

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/db/operations.ts src/db/__tests__/maintenance-quality.test.ts
git commit -m "feat: extend applyEvent to return eventId, add dbInstance injection"
```

---

## Task 3: Tablet server actions

**Files:**
- Modify: `src/app/tablet/[workCenterId]/actions.ts`

**Interfaces:**
- Consumes:
  - `applyEvent(operationId, event, opts, dbInstance?)` → `{ toStatus, eventId }` (Task 2)
  - `maintenanceRequest`, `qualityDefect` tables (Task 1)
  - `MaintenanceCategory`, `QualityDefectCategory` types (Task 1)
- Produces:
  - `reportMaintenanceAction(_prev, formData)` → `Promise<{ error: string } | null>`
    - FormData fields: `workCenterId` (number), `operationId` (number or empty string), `category` (MaintenanceCategory), `note` (string, optional), `operatorId` (string)
  - `rejectWithDefectAction(_prev, formData)` → `Promise<{ error: string } | null>`
    - FormData fields: `operationId` (number), `defectCategory` (QualityDefectCategory), `workCenterId` (string, for revalidation), `operatorId` (string)

- [ ] **Step 1: Replace the contents of `src/app/tablet/[workCenterId]/actions.ts`**

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { maintenanceRequest, qualityDefect } from '@/db/schema';
import { applyEvent } from '@/db/operations';
import type { MaintenanceCategory, OperationEventType, QualityDefectCategory } from '@/db/schema';

export async function applyEventAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | null> {
  const operationId = Number(formData.get('operationId'));
  const eventType = formData.get('eventType') as OperationEventType;
  const workCenterId = formData.get('workCenterId') as string;
  const operatorIdRaw = String(formData.get('operatorId') ?? '').trim();
  const operatorId = operatorIdRaw || undefined;

  try {
    await applyEvent(operationId, eventType, { operatorId });
    revalidatePath(`/tablet/${workCenterId}`);
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function reportMaintenanceAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | null> {
  const workCenterId = Number(formData.get('workCenterId'));
  const operationIdRaw = formData.get('operationId');
  const operationId = operationIdRaw ? Number(operationIdRaw) : null;
  const category = formData.get('category') as MaintenanceCategory;
  const note = (formData.get('note') as string | null) || null;
  const reportedBy = String(formData.get('operatorId') ?? '').trim() || 'unknown';

  try {
    await db.insert(maintenanceRequest).values({
      workCenterId,
      operationId,
      category,
      note,
      reportedBy,
    });
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function rejectWithDefectAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | null> {
  const operationId = Number(formData.get('operationId'));
  const defectCategory = formData.get('defectCategory') as QualityDefectCategory;
  const workCenterId = formData.get('workCenterId') as string;
  const operatorIdRaw = String(formData.get('operatorId') ?? '').trim();
  const operatorId = operatorIdRaw || undefined;
  const reportedBy = operatorId ?? 'unknown';

  try {
    const { eventId } = await applyEvent(operationId, 'REJECT', { operatorId });
    try {
      await db.insert(qualityDefect).values({
        operationId,
        operationEventId: eventId,
        category: defectCategory,
        reportedBy,
      });
    } catch (defectErr) {
      console.error('quality_defect insert failed after REJECT:', defectErr);
    }
    revalidatePath(`/tablet/${workCenterId}`);
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/tablet/[workCenterId]/actions.ts
git commit -m "feat: add reportMaintenanceAction and rejectWithDefectAction server actions"
```

---

## Task 4: `ConfirmModal` component

**Files:**
- Create: `src/app/tablet/[workCenterId]/ConfirmModal.tsx`

**Interfaces:**
- Produces:
  ```ts
  type ConfirmModalProps = {
    title: string;
    categories: { value: string; labelAr: string; labelEn: string }[];
    noteField?: boolean;
    onConfirm: (category: string, note?: string) => void;
    onCancel: () => void;
  };
  export function ConfirmModal(props: ConfirmModalProps): JSX.Element
  ```

- [ ] **Step 1: Create `src/app/tablet/[workCenterId]/ConfirmModal.tsx`**

```tsx
'use client';
import { useState } from 'react';

type Category = { value: string; labelAr: string; labelEn: string };

export function ConfirmModal({
  title,
  categories,
  noteField = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  categories: Category[];
  noteField?: boolean;
  onConfirm: (category: string, note?: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm" dir="rtl">
        <h2 className="text-xl font-bold mb-5 text-center text-white">{title}</h2>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {categories.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setSelected(cat.value)}
              className={`min-h-[68px] rounded-xl font-semibold text-sm transition-colors ${
                selected === cat.value
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
            >
              <div className="text-base">{cat.labelAr}</div>
              <div className="text-xs text-gray-300 font-normal mt-0.5">{cat.labelEn}</div>
            </button>
          ))}
        </div>

        {noteField && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ملاحظات / Notes (اختياري / optional)"
            rows={2}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm mb-4 text-white outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
        )}

        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-h-[52px] rounded-xl bg-gray-700 text-gray-200 font-semibold hover:bg-gray-600 transition-colors"
          >
            إلغاء / Cancel
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && onConfirm(selected, note.trim() || undefined)}
            className="flex-1 min-h-[52px] rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            تأكيد / Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/tablet/[workCenterId]/ConfirmModal.tsx
git commit -m "feat: add ConfirmModal overlay component for tablet"
```

---

## Task 5: Tablet client + page updates

**Files:**
- Modify: `src/app/tablet/[workCenterId]/client.tsx`
- Modify: `src/app/tablet/[workCenterId]/page.tsx`

**Interfaces:**
- Consumes:
  - `ConfirmModal` from Task 4
  - `reportMaintenanceAction`, `rejectWithDefectAction` from Task 3

- [ ] **Step 1: Update `src/app/tablet/[workCenterId]/page.tsx`**

Add the two new action imports and pass them as props. Replace the file content:

```tsx
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/db';
import {
  model,
  operationEvent,
  workCenter,
  workOrder,
  workOrderLine,
  workOrderOperation,
  type OperationStatus,
} from '@/db/schema';
import { TabletClient } from './client';
import { applyEventAction, reportMaintenanceAction, rejectWithDefectAction } from './actions';

const OPEN_STATUSES: OperationStatus[] = ['QUEUED', 'IN_PROGRESS', 'PAUSED', 'PENDING_QC'];

export default async function TabletPage({
  params,
}: {
  params: Promise<{ workCenterId: string }>;
}) {
  const { workCenterId: wcIdStr } = await params;
  const wcId = Number(wcIdStr);

  const [wc] = await db
    .select({
      id: workCenter.id,
      code: workCenter.code,
      nameAr: workCenter.nameAr,
      nameEn: workCenter.nameEn,
    })
    .from(workCenter)
    .where(eq(workCenter.id, wcId));

  if (!wc) notFound();

  const [queue, events] = await Promise.all([
    db
      .select({
        id: workOrderOperation.id,
        sequence: workOrderOperation.sequence,
        status: workOrderOperation.status,
        modelNameAr: model.nameAr,
        modelNameEn: model.nameEn,
        modelCode: model.code,
        orderNumber: workOrder.orderNumber,
        quantity: workOrderLine.quantity,
      })
      .from(workOrderOperation)
      .innerJoin(workOrderLine, eq(workOrderLine.id, workOrderOperation.workOrderLineId))
      .innerJoin(workOrder, eq(workOrder.id, workOrderLine.workOrderId))
      .innerJoin(model, eq(model.id, workOrderLine.modelId))
      .where(
        and(
          eq(workOrderOperation.workCenterId, wcId),
          inArray(workOrderOperation.status, OPEN_STATUSES),
        ),
      )
      .orderBy(asc(workOrderOperation.sequence)),

    db
      .select({
        id: operationEvent.id,
        eventType: operationEvent.eventType,
        operatorId: operationEvent.operatorId,
        occurredAt: operationEvent.occurredAt,
        modelNameAr: model.nameAr,
        modelCode: model.code,
      })
      .from(operationEvent)
      .innerJoin(workOrderOperation, eq(workOrderOperation.id, operationEvent.operationId))
      .innerJoin(workOrderLine, eq(workOrderLine.id, workOrderOperation.workOrderLineId))
      .innerJoin(model, eq(model.id, workOrderLine.modelId))
      .where(eq(workOrderOperation.workCenterId, wcId))
      .orderBy(desc(operationEvent.occurredAt))
      .limit(15),
  ]);

  return (
    <TabletClient
      workCenter={wc}
      queue={queue}
      events={events}
      onAction={applyEventAction}
      onMaintenance={reportMaintenanceAction}
      onRejectWithDefect={rejectWithDefectAction}
    />
  );
}
```

- [ ] **Step 2: Replace `src/app/tablet/[workCenterId]/client.tsx`**

Full replacement — adds modal state, `useTransition`, maintenance button, and changed reject flow:

```tsx
'use client';
import { useState, useEffect, useActionState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { OperationStatus, OperationEventType } from '@/db/schema';
import type { applyEventAction, reportMaintenanceAction, rejectWithDefectAction } from './actions';
import { ConfirmModal } from './ConfirmModal';

// ---- Types ----

type WorkCenter = { id: number; code: string; nameAr: string; nameEn: string };

type QueueItem = {
  id: number;
  sequence: number;
  status: OperationStatus;
  modelNameAr: string;
  modelNameEn: string;
  modelCode: string;
  orderNumber: string;
  quantity: number;
};

type EventItem = {
  id: number;
  eventType: OperationEventType;
  operatorId: string | null;
  occurredAt: string;
  modelNameAr: string;
  modelCode: string;
};

// ---- Label / badge maps ----

const STATUS_BADGE: Record<OperationStatus, string> = {
  QUEUED:     'bg-gray-600 text-gray-100',
  IN_PROGRESS:'bg-green-700 text-green-100',
  PAUSED:     'bg-amber-700 text-amber-100',
  PENDING_QC: 'bg-blue-700 text-blue-100',
  COMPLETED:  'bg-emerald-700 text-emerald-100',
  REJECTED:   'bg-red-700 text-red-100',
};

const STATUS_LABEL: Record<OperationStatus, string> = {
  QUEUED:     'في الانتظار / Queued',
  IN_PROGRESS:'جاري التنفيذ / In Progress',
  PAUSED:     'موقوف / Paused',
  PENDING_QC: 'بانتظار الجودة / Pending QC',
  COMPLETED:  'مكتمل / Completed',
  REJECTED:   'مرفوض / Rejected',
};

const EVENT_BADGE: Record<OperationEventType, string> = {
  START:  'bg-green-900 text-green-300',
  PAUSE:  'bg-amber-900 text-amber-300',
  RESUME: 'bg-green-900 text-green-300',
  FINISH: 'bg-blue-900 text-blue-300',
  ACCEPT: 'bg-emerald-900 text-emerald-300',
  REJECT: 'bg-red-900 text-red-300',
};

const EVENT_LABEL: Record<OperationEventType, string> = {
  START:  'بدء',
  PAUSE:  'إيقاف',
  RESUME: 'استئناف',
  FINISH: 'إنهاء',
  ACCEPT: 'قبول',
  REJECT: 'رفض',
};

const MAINTENANCE_CATEGORIES = [
  { value: 'MECHANICAL', labelAr: 'ميكانيكي', labelEn: 'Mechanical' },
  { value: 'ELECTRICAL', labelAr: 'كهربائي',  labelEn: 'Electrical' },
  { value: 'TOOLING',    labelAr: 'أدوات',    labelEn: 'Tooling' },
  { value: 'OTHER',      labelAr: 'أخرى',     labelEn: 'Other' },
];

const DEFECT_CATEGORIES = [
  { value: 'DIMENSIONAL', labelAr: 'أبعاد',   labelEn: 'Dimensional' },
  { value: 'SURFACE',     labelAr: 'سطح',     labelEn: 'Surface / Paint' },
  { value: 'ASSEMBLY',    labelAr: 'تجميع',   labelEn: 'Assembly' },
  { value: 'OTHER',       labelAr: 'أخرى',    labelEn: 'Other' },
];

// ---- ActionForm helper ----

function ActionForm({
  op,
  eventType,
  label,
  colorClass,
  workCenterId,
  operatorId,
  dispatch,
  onSubmit,
}: {
  op: QueueItem;
  eventType: OperationEventType;
  label: string;
  colorClass: string;
  workCenterId: number;
  operatorId: string;
  dispatch: (payload: FormData) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form action={dispatch} onSubmit={onSubmit} className="flex-1">
      <input type="hidden" name="operationId" value={op.id} />
      <input type="hidden" name="eventType" value={eventType} />
      <input type="hidden" name="workCenterId" value={workCenterId} />
      <input type="hidden" name="operatorId" value={operatorId} />
      <button
        type="submit"
        className={`w-full min-h-[72px] text-xl font-bold rounded-xl text-white transition-colors ${colorClass}`}
      >
        {label}
      </button>
    </form>
  );
}

// ---- Main component ----

type Modal = 'maintenance' | 'reject' | null;

export function TabletClient({
  workCenter,
  queue,
  events,
  onAction,
  onMaintenance,
  onRejectWithDefect,
}: {
  workCenter: WorkCenter;
  queue: QueueItem[];
  events: EventItem[];
  onAction: typeof applyEventAction;
  onMaintenance: typeof reportMaintenanceAction;
  onRejectWithDefect: typeof rejectWithDefectAction;
}) {
  const router = useRouter();
  const [operatorId, setOperatorId] = useState('');
  const [operatorError, setOperatorError] = useState(false);
  const [actionState, dispatchAction] = useActionState(onAction, null);
  const [displayError, setDisplayError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const id = setInterval(() => {
      setDisplayError(null);
      router.refresh();
    }, 8000);
    return () => clearInterval(id);
  }, [router]);

  useEffect(() => {
    if (actionState?.error) {
      setDisplayError(actionState.error);
      router.refresh();
    }
  }, [actionState, router]);

  const active = queue[0] ?? null;
  const upcoming = queue.slice(1);

  function handleActionSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!operatorId.trim()) {
      e.preventDefault();
      setOperatorError(true);
      return;
    }
    setOperatorError(false);
    setDisplayError(null);
  }

  function handleRejectClick() {
    if (!operatorId.trim()) {
      setOperatorError(true);
      return;
    }
    setOperatorError(false);
    setModal('reject');
  }

  function handleMaintenanceClick() {
    setModal('maintenance');
  }

  function handleMaintenanceConfirm(category: string, note?: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.append('workCenterId', String(workCenter.id));
      if (active) fd.append('operationId', String(active.id));
      fd.append('category', category);
      if (note) fd.append('note', note);
      fd.append('operatorId', operatorId);
      const result = await onMaintenance(null, fd);
      setModal(null);
      if (result?.error) setDisplayError(result.error);
    });
  }

  function handleRejectConfirm(defectCategory: string) {
    if (!active) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append('operationId', String(active.id));
      fd.append('defectCategory', defectCategory);
      fd.append('workCenterId', String(workCenter.id));
      fd.append('operatorId', operatorId);
      const result = await onRejectWithDefect(null, fd);
      setModal(null);
      if (result?.error) setDisplayError(result.error);
      router.refresh();
    });
  }

  return (
    <div dir="rtl" className="bg-gray-950 text-white min-h-screen flex flex-col">
      {/* Modals */}
      {modal === 'maintenance' && (
        <ConfirmModal
          title="نوع العطل / Problem Type"
          categories={MAINTENANCE_CATEGORIES}
          noteField
          onConfirm={handleMaintenanceConfirm}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === 'reject' && (
        <ConfirmModal
          title="سبب الرفض / Defect Type"
          categories={DEFECT_CATEGORIES}
          onConfirm={handleRejectConfirm}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold">{workCenter.nameAr}</h1>
          <p className="text-sm text-gray-400">{workCenter.nameEn} · {workCenter.code}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <input
            type="text"
            value={operatorId}
            onChange={(e) => {
              setOperatorId(e.target.value);
              setOperatorError(false);
            }}
            placeholder="رقم الموظف / Badge ID"
            className={`bg-gray-800 border rounded px-3 py-2 text-sm w-48 outline-none focus:ring-1 focus:ring-blue-500 ${
              operatorError ? 'border-red-500' : 'border-gray-600'
            }`}
          />
          {operatorError && (
            <p className="text-red-400 text-xs">أدخل رقم الموظف / Enter badge ID</p>
          )}
        </div>
      </header>

      {/* Main area */}
      <div className="flex-1 flex flex-col gap-4 p-4 overflow-hidden">

        {/* Active operation card */}
        {active ? (
          <div className="bg-gray-800 rounded-2xl p-6 flex-shrink-0">
            <div className="flex items-start justify-between mb-4 gap-4">
              <div className="min-w-0">
                <h2 className="text-4xl font-bold leading-tight">{active.modelNameAr}</h2>
                <p className="text-sm text-gray-400 mt-1">
                  {active.orderNumber} · تسلسل {active.sequence}
                </p>
              </div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium flex-shrink-0 ${STATUS_BADGE[active.status]}`}
              >
                {STATUS_LABEL[active.status]}
              </span>
            </div>

            {/* FSM buttons */}
            <div className="flex gap-3">
              {active.status === 'QUEUED' && (
                <ActionForm
                  op={active}
                  eventType="START"
                  label="بدء / Start"
                  colorClass="bg-green-600 hover:bg-green-500"
                  workCenterId={workCenter.id}
                  operatorId={operatorId}
                  dispatch={dispatchAction}
                  onSubmit={handleActionSubmit}
                />
              )}
              {active.status === 'IN_PROGRESS' && (
                <>
                  <ActionForm
                    op={active}
                    eventType="PAUSE"
                    label="إيقاف / Pause"
                    colorClass="bg-amber-500 hover:bg-amber-400"
                    workCenterId={workCenter.id}
                    operatorId={operatorId}
                    dispatch={dispatchAction}
                    onSubmit={handleActionSubmit}
                  />
                  <ActionForm
                    op={active}
                    eventType="FINISH"
                    label="إنهاء / Finish"
                    colorClass="bg-blue-600 hover:bg-blue-500"
                    workCenterId={workCenter.id}
                    operatorId={operatorId}
                    dispatch={dispatchAction}
                    onSubmit={handleActionSubmit}
                  />
                </>
              )}
              {active.status === 'PAUSED' && (
                <ActionForm
                  op={active}
                  eventType="RESUME"
                  label="استئناف / Resume"
                  colorClass="bg-green-600 hover:bg-green-500"
                  workCenterId={workCenter.id}
                  operatorId={operatorId}
                  dispatch={dispatchAction}
                  onSubmit={handleActionSubmit}
                />
              )}
              {active.status === 'PENDING_QC' && (
                <>
                  <ActionForm
                    op={active}
                    eventType="ACCEPT"
                    label="قبول / Accept"
                    colorClass="bg-green-600 hover:bg-green-500"
                    workCenterId={workCenter.id}
                    operatorId={operatorId}
                    dispatch={dispatchAction}
                    onSubmit={handleActionSubmit}
                  />
                  <button
                    type="button"
                    onClick={handleRejectClick}
                    disabled={isPending}
                    className="flex-1 min-h-[72px] text-xl font-bold rounded-xl text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors"
                  >
                    رفض / Reject
                  </button>
                </>
              )}
            </div>

            {displayError && (
              <p className="text-red-400 text-sm mt-3">
                ⚠ {displayError}
              </p>
            )}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-2xl p-6 flex-shrink-0 flex items-center justify-center min-h-[200px]">
            <p className="text-gray-400 text-xl text-center">
              لا توجد عمليات مفتوحة
              <br />
              <span className="text-base text-gray-500">No open operations</span>
            </p>
          </div>
        )}

        {/* Upcoming queue list */}
        {upcoming.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-4 flex-shrink-0">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">الطابور / Queue</h3>
            <div className="space-y-2 max-h-44 overflow-y-auto">
              {upcoming.map((op) => (
                <div
                  key={op.id}
                  className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-gray-500 text-sm flex-shrink-0">{op.sequence}</span>
                    <span className="font-medium truncate">{op.modelNameAr}</span>
                    <span className="text-gray-400 text-sm flex-shrink-0">{op.orderNumber}</span>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ms-2 ${STATUS_BADGE[op.status]}`}
                  >
                    {STATUS_LABEL[op.status].split(' / ')[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event feed */}
        <div className="bg-gray-900 rounded-xl p-4 flex-1 min-h-0 flex flex-col">
          <h3 className="text-sm font-semibold text-gray-400 mb-3 flex-shrink-0">السجل / Log</h3>
          <div className="overflow-y-auto flex-1">
            {events.length === 0 ? (
              <p className="text-gray-600 text-sm">لا توجد أحداث / No events yet</p>
            ) : (
              <div className="space-y-1.5">
                {events.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-3 text-sm py-1">
                    <span className="text-gray-500 text-xs w-12 flex-shrink-0 font-mono">
                      {ev.occurredAt.slice(11, 16)}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${EVENT_BADGE[ev.eventType]}`}
                    >
                      {EVENT_LABEL[ev.eventType]}
                    </span>
                    <span className="text-gray-300 truncate">{ev.modelNameAr}</span>
                    {ev.operatorId && (
                      <span className="text-gray-500 text-xs flex-shrink-0">{ev.operatorId}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer nav */}
      <footer className="px-6 py-3 bg-gray-900 border-t border-gray-800 flex-shrink-0 flex items-center justify-between">
        <Link href="/tablet" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          ← محطات العمل / Work Centers
        </Link>
        <button
          type="button"
          onClick={handleMaintenanceClick}
          disabled={isPending}
          className="text-xs text-amber-500 hover:text-amber-400 disabled:opacity-50 transition-colors font-medium"
        >
          ⚠ إبلاغ عن عطل / Report Maintenance
        </button>
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: all pass.

- [ ] **Step 5: Manual smoke test**

Start dev server: `npm run dev`

Navigate to `http://localhost:3000/tablet` → pick work center → verify:
1. Footer shows "⚠ إبلاغ عن عطل / Report Maintenance" button
2. Tapping maintenance opens 4-category modal with optional notes + confirm/cancel
3. Cancel dismisses, Confirm inserts (check console/db)
4. Advance an operation to PENDING_QC (Start → Finish) → Reject button opens defect-category modal
5. Cancel from reject modal leaves op in PENDING_QC
6. Confirm reject fires the action, op moves to REJECTED

- [ ] **Step 6: Commit**

```bash
git add src/app/tablet/[workCenterId]/client.tsx src/app/tablet/[workCenterId]/page.tsx
git commit -m "feat: add maintenance button and reject-modal flow to tablet UI"
```

---

## Task 6: Admin maintenance page

**Files:**
- Create: `src/app/admin/maintenance/page.tsx`
- Create: `src/app/admin/maintenance/client.tsx`
- Create: `src/app/admin/maintenance/actions.ts`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: `maintenanceRequest`, `workCenter` tables (Task 1)
- Produces: `resolveMaintenanceAction(id: number): Promise<void>`

- [ ] **Step 1: Create `src/app/admin/maintenance/actions.ts`**

```ts
'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { maintenanceRequest } from '@/db/schema';

export async function resolveMaintenanceAction(id: number): Promise<void> {
  await db
    .update(maintenanceRequest)
    .set({ status: 'RESOLVED', resolvedAt: new Date().toISOString() })
    .where(eq(maintenanceRequest.id, id));
  revalidatePath('/admin/maintenance');
}
```

- [ ] **Step 2: Create `src/app/admin/maintenance/client.tsx`**

```tsx
'use client';
import { useTransition, useState } from 'react';
import type { MaintenanceCategory, MaintenanceStatus } from '@/db/schema';
import type { resolveMaintenanceAction } from './actions';

type Row = {
  id: number;
  workCenterNameAr: string;
  workCenterCode: string;
  category: MaintenanceCategory;
  note: string | null;
  reportedBy: string;
  status: MaintenanceStatus;
  createdAt: string;
};

const CATEGORY_LABEL: Record<MaintenanceCategory, string> = {
  MECHANICAL: 'ميكانيكي / Mechanical',
  ELECTRICAL: 'كهربائي / Electrical',
  TOOLING:    'أدوات / Tooling',
  OTHER:      'أخرى / Other',
};

const CATEGORY_COLOR: Record<MaintenanceCategory, string> = {
  MECHANICAL: 'bg-orange-900 text-orange-300',
  ELECTRICAL: 'bg-yellow-900 text-yellow-300',
  TOOLING:    'bg-purple-900 text-purple-300',
  OTHER:      'bg-gray-700 text-gray-300',
};

type Filter = 'ALL' | 'OPEN' | 'RESOLVED';

export function MaintenanceClient({
  data,
  onResolve,
}: {
  data: Row[];
  onResolve: typeof resolveMaintenanceAction;
}) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [isPending, startTransition] = useTransition();

  const filtered = filter === 'ALL' ? data : data.filter((r) => r.status === filter);

  function handleResolve(id: number) {
    startTransition(async () => {
      await onResolve(id);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Maintenance Requests / طلبات الصيانة</h1>
        <div className="flex gap-2">
          {(['ALL', 'OPEN', 'RESOLVED'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {f === 'ALL' ? 'All' : f === 'OPEN' ? 'Open' : 'Resolved'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500">No records.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-left">
              <th className="pb-2 pr-4">Work Center</th>
              <th className="pb-2 pr-4">Category</th>
              <th className="pb-2 pr-4">Note</th>
              <th className="pb-2 pr-4">Reporter</th>
              <th className="pb-2 pr-4">Time</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                <td className="py-3 pr-4">
                  <div className="font-medium">{row.workCenterNameAr}</div>
                  <div className="text-gray-500 text-xs">{row.workCenterCode}</div>
                </td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLOR[row.category]}`}>
                    {CATEGORY_LABEL[row.category]}
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-300 max-w-xs truncate">
                  {row.note ?? <span className="text-gray-600">—</span>}
                </td>
                <td className="py-3 pr-4 text-gray-400">{row.reportedBy}</td>
                <td className="py-3 pr-4 text-gray-400 font-mono text-xs whitespace-nowrap">
                  {row.createdAt.slice(0, 16).replace('T', ' ')}
                </td>
                <td className="py-3">
                  {row.status === 'OPEN' ? (
                    <button
                      onClick={() => handleResolve(row.id)}
                      disabled={isPending}
                      className="px-3 py-1 rounded text-xs font-medium bg-green-800 text-green-200 hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      Mark Resolved / تم الحل
                    </button>
                  ) : (
                    <span className="text-xs text-gray-500">Resolved</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/admin/maintenance/page.tsx`**

```tsx
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { maintenanceRequest, workCenter } from '@/db/schema';
import { MaintenanceClient } from './client';
import { resolveMaintenanceAction } from './actions';

export default async function MaintenancePage() {
  const requests = await db
    .select({
      id: maintenanceRequest.id,
      workCenterNameAr: workCenter.nameAr,
      workCenterCode: workCenter.code,
      category: maintenanceRequest.category,
      note: maintenanceRequest.note,
      reportedBy: maintenanceRequest.reportedBy,
      status: maintenanceRequest.status,
      createdAt: maintenanceRequest.createdAt,
    })
    .from(maintenanceRequest)
    .innerJoin(workCenter, eq(maintenanceRequest.workCenterId, workCenter.id))
    .orderBy(desc(maintenanceRequest.createdAt));

  return <MaintenanceClient data={requests} onResolve={resolveMaintenanceAction} />;
}
```

- [ ] **Step 4: Add Maintenance + Quality links to `src/app/admin/layout.tsx`**

In the `NAV` array, add after the `Routing` entry:

```ts
{ href: '/admin/maintenance', label: 'Maintenance' },
{ href: '/admin/quality',     label: 'Quality' },
```

Full updated `NAV`:

```ts
const NAV = [
  { href: '/admin/departments',    label: 'Departments' },
  { href: '/admin/work-centers',   label: 'Work Centers' },
  { href: '/admin/models',         label: 'Models' },
  { href: '/admin/color-families', label: 'Color Families' },
  { href: '/admin/colors',         label: 'Colors' },
  { href: '/admin/routing',        label: 'Routing' },
  { href: '/admin/maintenance',    label: 'Maintenance' },
  { href: '/admin/quality',        label: 'Quality' },
];
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Manual smoke test**

Navigate to `http://localhost:3000/admin/maintenance`:
- Page loads with the new nav links visible
- Filter buttons (All / Open / Resolved) work
- If a maintenance request was submitted in Task 5's smoke test, it appears
- "Mark Resolved" button updates the row status

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/maintenance/ src/app/admin/layout.tsx
git commit -m "feat: add admin maintenance page with resolve action"
```

---

## Task 7: Admin quality defects page

**Files:**
- Create: `src/app/admin/quality/page.tsx`

**Interfaces:**
- Consumes: `qualityDefect`, `workOrderOperation`, `workOrderLine`, `workOrder`, `model`, `workCenter` tables

- [ ] **Step 1: Create `src/app/admin/quality/page.tsx`**

```tsx
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { qualityDefect, workOrderOperation, workOrderLine, workOrder, model, workCenter } from '@/db/schema';
import type { QualityDefectCategory } from '@/db/schema';

const CATEGORY_LABEL: Record<QualityDefectCategory, string> = {
  DIMENSIONAL: 'أبعاد / Dimensional',
  SURFACE:     'سطح / Surface + Paint',
  ASSEMBLY:    'تجميع / Assembly',
  OTHER:       'أخرى / Other',
};

const CATEGORY_COLOR: Record<QualityDefectCategory, string> = {
  DIMENSIONAL: 'bg-red-900 text-red-300',
  SURFACE:     'bg-orange-900 text-orange-300',
  ASSEMBLY:    'bg-yellow-900 text-yellow-300',
  OTHER:       'bg-gray-700 text-gray-300',
};

export default async function QualityPage() {
  const defects = await db
    .select({
      id: qualityDefect.id,
      category: qualityDefect.category,
      reportedBy: qualityDefect.reportedBy,
      createdAt: qualityDefect.createdAt,
      orderNumber: workOrder.orderNumber,
      modelNameAr: model.nameAr,
      modelCode: model.code,
      workCenterNameAr: workCenter.nameAr,
      workCenterCode: workCenter.code,
    })
    .from(qualityDefect)
    .innerJoin(workOrderOperation, eq(qualityDefect.operationId, workOrderOperation.id))
    .innerJoin(workOrderLine, eq(workOrderOperation.workOrderLineId, workOrderLine.id))
    .innerJoin(workOrder, eq(workOrderLine.workOrderId, workOrder.id))
    .innerJoin(model, eq(workOrderLine.modelId, model.id))
    .innerJoin(workCenter, eq(workOrderOperation.workCenterId, workCenter.id))
    .orderBy(desc(qualityDefect.createdAt));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Quality Defects / عيوب الجودة</h1>

      {defects.length === 0 ? (
        <p className="text-gray-500">No defects recorded.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-left">
              <th className="pb-2 pr-4">Order</th>
              <th className="pb-2 pr-4">Model</th>
              <th className="pb-2 pr-4">Work Center</th>
              <th className="pb-2 pr-4">Defect Type</th>
              <th className="pb-2 pr-4">Reporter</th>
              <th className="pb-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {defects.map((row) => (
              <tr key={row.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                <td className="py-3 pr-4 font-mono text-sm">{row.orderNumber}</td>
                <td className="py-3 pr-4">
                  <div className="font-medium">{row.modelNameAr}</div>
                  <div className="text-gray-500 text-xs">{row.modelCode}</div>
                </td>
                <td className="py-3 pr-4">
                  <div>{row.workCenterNameAr}</div>
                  <div className="text-gray-500 text-xs">{row.workCenterCode}</div>
                </td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLOR[row.category]}`}>
                    {CATEGORY_LABEL[row.category]}
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-400">{row.reportedBy}</td>
                <td className="py-3 text-gray-400 font-mono text-xs whitespace-nowrap">
                  {row.createdAt.slice(0, 16).replace('T', ' ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all pass.

- [ ] **Step 4: Manual smoke test**

Navigate to `http://localhost:3000/admin/quality`:
- Page loads, "Quality" link active in sidebar
- If a reject-with-defect was performed in Task 5's smoke test, the row appears with order number, model, work center, category badge, reporter

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/quality/page.tsx
git commit -m "feat: add admin quality defects page (read-only)"
```
