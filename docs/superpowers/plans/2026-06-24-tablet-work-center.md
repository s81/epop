# Tablet Work-Center Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shop-floor tablet screen — a full-screen, RTL Arabic, touch-first interface showing a work center's open-operation queue with FSM action buttons, auto-polling, and a live event feed.

**Architecture:** Server pages fetch queue and event data from the DB and pass them to a `'use client'` TabletClient component. The client polls via `router.refresh()` every 8 seconds. Action buttons (one `<form>` per FSM event) submit to a server action that calls `applyEvent()`. No API routes, no new dependencies.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, libSQL/Turso, TypeScript, Tailwind CSS

## Global Constraints

- All FSM mutations MUST go through `applyEvent()` in `src/db/operations.ts` — no raw UPDATEs anywhere
- Every visible label must appear in **Arabic and English** (Arabic primary, English secondary)
- Touch targets: minimum `min-h-[72px]` on action buttons
- Layout direction: `dir="rtl"` on the main content area
- No auth gate (deferred per CLAUDE.md; add before network deployment)
- Follow existing server-page → client-component pattern (same as `src/app/orders/[id]/`)
- `params` in Next.js 15 is `Promise<{ ... }>` — always `await params`
- Use `useActionState` from `'react'` (not `react-dom`) — matches existing code in `src/app/orders/[id]/client.tsx`
- Bilingual: Arabic name first, English name second, separated by ` / `
- Background: `bg-gray-950 text-white` for full-screen tablet feel
- No sidebar — tablet layout is full-screen only

---

## File Map

| File | Role |
|---|---|
| `src/app/tablet/layout.tsx` | Full-screen dark layout — no sidebar |
| `src/app/tablet/page.tsx` | Server: list all work centers |
| `src/app/tablet/[workCenterId]/actions.ts` | Server action: `applyEventAction` → calls `applyEvent()` |
| `src/app/tablet/[workCenterId]/page.tsx` | Server: fetch queue + event feed, render TabletClient |
| `src/app/tablet/[workCenterId]/client.tsx` | Client: polling, operator ID, FSM action forms, event feed |
| `src/app/orders/layout.tsx` | **Modify**: add "Tablet →" footer link |

---

## Task 1: Full-screen layout + work center selector

**Files:**
- Create: `src/app/tablet/layout.tsx`
- Create: `src/app/tablet/page.tsx`
- Modify: `src/app/orders/layout.tsx` (add "Tablet →" footer link)

**Interfaces:**
- Produces: `layout.tsx` wraps all tablet routes in a full-screen dark shell; `page.tsx` exports a default async page component listing work centers as tappable cards

There are no automated tests for pure presentation layers in this project. Verification is TypeScript type-check + manual visual inspection.

- [ ] **Step 1: Create the full-screen layout**

Create `src/app/tablet/layout.tsx`:

```tsx
export default function TabletLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-950 text-white min-h-screen">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create the work center selector page**

Create `src/app/tablet/page.tsx`:

```tsx
import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { db } from '@/db/db';
import { workCenter } from '@/db/schema';

export default async function TabletIndexPage() {
  const centers = await db
    .select({
      id: workCenter.id,
      code: workCenter.code,
      nameAr: workCenter.nameAr,
      nameEn: workCenter.nameEn,
    })
    .from(workCenter)
    .orderBy(asc(workCenter.code));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-2">e-pop</h1>
      <p className="text-gray-400 mb-8 text-lg">اختر محطة العمل / Select Work Center</p>
      {centers.length === 0 ? (
        <p className="text-gray-500">No work centers configured — add them in Master Data.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-2xl">
          {centers.map((wc) => (
            <Link
              key={wc.id}
              href={`/tablet/${wc.id}`}
              className="bg-gray-800 hover:bg-gray-700 transition-colors rounded-2xl p-6 flex flex-col items-center gap-2 text-center min-h-[120px] justify-center"
            >
              <span className="text-xl font-bold">{wc.nameAr}</span>
              <span className="text-sm text-gray-400">{wc.nameEn}</span>
              <span className="text-xs text-gray-500 font-mono">{wc.code}</span>
            </Link>
          ))}
        </div>
      )}
      <div className="mt-8">
        <Link href="/orders" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          ← Work Orders
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add "Tablet →" footer link to orders layout**

Open `src/app/orders/layout.tsx`. The file currently ends the aside with:

```tsx
        <div className="px-4 py-3 border-t border-gray-700">
          <Link href="/admin" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            ← Master Data
          </Link>
        </div>
```

Replace that block with:

```tsx
        <div className="px-4 py-3 border-t border-gray-700 flex flex-col gap-1">
          <Link href="/tablet" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            Tablet →
          </Link>
          <Link href="/admin" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            ← Master Data
          </Link>
        </div>
```

- [ ] **Step 4: TypeScript compile check**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Manual visual check**

Start the dev server (`npm run dev`), navigate to `/tablet`. Confirm:
- Dark background, no sidebar
- Work center cards visible (if any work centers exist in DB)
- Each card links to `/tablet/[id]`
- "← Work Orders" link at the bottom

Navigate to `/orders` and confirm the "Tablet →" link appears in the sidebar footer.

- [ ] **Step 6: Commit**

```bash
git add src/app/tablet/layout.tsx src/app/tablet/page.tsx src/app/orders/layout.tsx
git commit -m "Add tablet layout and work center selector"
```

---

## Task 2: Server action — `applyEventAction`

**Files:**
- Create: `src/app/tablet/[workCenterId]/actions.ts`

**Interfaces:**
- Consumes: `applyEvent(operationId, eventType, { operatorId })` from `src/db/operations.ts`; `OperationEventType` from `src/db/schema`
- Produces:
  ```ts
  export async function applyEventAction(
    _prev: unknown,
    formData: FormData,
  ): Promise<{ error: string } | null>
  ```
  Returns `null` on success, `{ error: string }` on any failure (including `IllegalTransition`).

There are no unit tests for this action: `applyEvent` is fully tested in `src/db/__tests__/release.test.ts`, and `revalidatePath` cannot be called in unit tests. Verification is TypeScript type-check + manual.

- [ ] **Step 1: Create the server action file**

Create `src/app/tablet/[workCenterId]/actions.ts`:

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { applyEvent } from '@/db/operations';
import type { OperationEventType } from '@/db/schema';

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
```

- [ ] **Step 2: TypeScript compile check**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/tablet/[workCenterId]/actions.ts
git commit -m "Add applyEventAction server action for tablet"
```

---

## Task 3: Tablet server page — queue and event feed queries

**Files:**
- Create: `src/app/tablet/[workCenterId]/page.tsx`

**Interfaces:**
- Consumes: `applyEventAction` from `./actions`; `TabletClient` from `./client` (created in Task 4)
- Produces: default async page component; passes these typed props to `TabletClient`:

```ts
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
```

The `TabletClient` component does not exist yet (Task 4). Use a temporary stub to satisfy TypeScript during this task.

- [ ] **Step 1: Create a temporary TabletClient stub**

Create `src/app/tablet/[workCenterId]/client.tsx` with a minimal stub (will be fully replaced in Task 4):

```tsx
'use client';
import type { OperationStatus, OperationEventType } from '@/db/schema';
import type { applyEventAction } from './actions';

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

export function TabletClient(_props: {
  workCenter: WorkCenter;
  queue: QueueItem[];
  events: EventItem[];
  onAction: typeof applyEventAction;
}) {
  return <div>Tablet stub — replaced in Task 4</div>;
}
```

- [ ] **Step 2: Create the server page**

Create `src/app/tablet/[workCenterId]/page.tsx`:

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
import { applyEventAction } from './actions';

const OPEN_STATUSES: OperationStatus[] = ['QUEUED', 'IN_PROGRESS', 'PAUSED'];

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
    // Queue query — hits ix_op_open partial index
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

    // Event feed query — last 15 events for this work center
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
    />
  );
}
```

- [ ] **Step 3: TypeScript compile check**

Run: `npx tsc --noEmit`

Expected: no errors. (The stub client is enough to satisfy the imports.)

- [ ] **Step 4: Commit**

```bash
git add src/app/tablet/[workCenterId]/page.tsx src/app/tablet/[workCenterId]/client.tsx
git commit -m "Add tablet server page with queue and event feed queries"
```

---

## Task 4: TabletClient — polling, operator ID, FSM buttons, event feed

**Files:**
- Modify (replace stub): `src/app/tablet/[workCenterId]/client.tsx`

**Interfaces:**
- Consumes: props from `page.tsx` as typed in Task 3; `applyEventAction` signature from `actions.ts`
- Consumes: `useActionState` from `'react'`, `useRouter` from `'next/navigation'`

There are no unit tests for this UI component — verification is TypeScript type-check + manual interaction on the dev server.

- [ ] **Step 1: Replace the stub with the full TabletClient**

Overwrite `src/app/tablet/[workCenterId]/client.tsx` with the full component:

```tsx
'use client';
import { useState, useEffect, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { OperationStatus, OperationEventType } from '@/db/schema';
import type { applyEventAction } from './actions';

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

export function TabletClient({
  workCenter,
  queue,
  events,
  onAction,
}: {
  workCenter: WorkCenter;
  queue: QueueItem[];
  events: EventItem[];
  onAction: typeof applyEventAction;
}) {
  const router = useRouter();
  const [operatorId, setOperatorId] = useState('');
  const [operatorError, setOperatorError] = useState(false);
  const [actionState, dispatchAction] = useActionState(onAction, null);
  const [displayError, setDisplayError] = useState<string | null>(null);

  // Poll every 8s: clear error + refresh RSC data
  useEffect(() => {
    const id = setInterval(() => {
      setDisplayError(null);
      router.refresh();
    }, 8000);
    return () => clearInterval(id);
  }, [router]);

  // Sync action error → displayError; immediate refresh on error (race recovery)
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

  return (
    <div dir="rtl" className="bg-gray-950 text-white min-h-screen flex flex-col">
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

            {/* FSM buttons — one form per event type */}
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
                  <ActionForm
                    op={active}
                    eventType="REJECT"
                    label="رفض / Reject"
                    colorClass="bg-red-600 hover:bg-red-500"
                    workCenterId={workCenter.id}
                    operatorId={operatorId}
                    dispatch={dispatchAction}
                    onSubmit={handleActionSubmit}
                  />
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
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${STATUS_BADGE[op.status]}`}
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
      <footer className="px-6 py-3 bg-gray-900 border-t border-gray-800 flex-shrink-0">
        <Link href="/tablet" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          ← محطات العمل / Work Centers
        </Link>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript compile check**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Manual interaction test — golden path**

Start dev server (`npm run dev`). Ensure you have at least one released work order with operations (run the existing orders UI to create and release one if needed).

1. Go to `/tablet` — confirm work center cards appear.
2. Tap a work center — confirm the tablet screen opens with `dir="rtl"`.
3. Confirm the active operation card shows at the top with the model's Arabic name.
4. Confirm the queue list shows below (if multiple ops exist).
5. Try tapping "بدء / Start" WITHOUT entering a badge ID — confirm the operator field highlights red and the form does not submit.
6. Enter a badge ID, tap "بدء / Start" — confirm the status badge changes to "جاري التنفيذ" and the event feed shows a "بدء" entry.
7. Tap "إنهاء / Finish" — confirm status changes to "بانتظار الجودة".
8. Tap "قبول / Accept" — confirm the operation disappears from the queue (it's now COMPLETED, excluded by `ix_op_open`).
9. Wait 8 seconds — confirm polling still works (no console errors).

- [ ] **Step 4: Manual edge case checks**

1. Go to a work center with no open operations — confirm "لا توجد عمليات مفتوحة / No open operations" message appears.
2. Go to `/tablet/99999` (non-existent ID) — confirm Next.js 404 page appears.
3. In two browser tabs pointed at the same work center, start the same operation in tab A, then try to start it again in tab B — confirm tab B shows an error message (IllegalTransition from the FSM).

- [ ] **Step 5: Commit**

```bash
git add src/app/tablet/[workCenterId]/client.tsx
git commit -m "Add TabletClient with polling, FSM buttons, and event feed"
```

---

## Done

After all 4 tasks complete and pass review, Phase 4 is complete. The tablet screen is fully functional: open-operation queue via `ix_op_open`, FSM-driven action buttons via `applyEvent`, 8-second polling via `router.refresh()`, operator badge tracking, and a live event feed.

**Reminder from CLAUDE.md:** Add auth middleware guarding `/tablet/*` before deploying to any networked environment.
