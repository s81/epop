# Production Order + Release — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build work order CRUD (header + lines, DRAFT state) and a Release action that explodes each line's routing into `work_order_operation` rows — one per line × routing step.

**Architecture:** A new `/orders/` route with its own layout (separate from `/admin/` master data). Release business logic lives in `src/db/operations.ts` alongside `applyEvent()`. The UI follows the established pattern: server page fetches and passes data to a client component; mutations go through `'use server'` actions.

**Tech Stack:** Next.js 15 App Router · Drizzle ORM · libSQL/SQLite · Tailwind CSS · TypeScript · Vitest (added in Task 1)

## Global Constraints

- Never raw `UPDATE` from the UI — all order state changes go through `src/db/operations.ts`
- `PRAGMA foreign_keys = ON` must be set on every DB connection
- Bilingual labels: every visible heading/label includes Arabic + English
- No auth gate (deferred — see CLAUDE.md)
- TypeScript strict: run `npx tsc --noEmit` to verify before each commit
- Pattern: server page → `'use client'` component → Dialog modal → `useActionState` form
- `revalidatePath` must be called after every mutation

---

## File Map

**New files:**
| File | Responsibility |
|---|---|
| `vitest.config.ts` | Vitest config with `@/` path alias |
| `src/db/__tests__/release.test.ts` | Unit tests for `releaseWorkOrder` |
| `src/app/orders/layout.tsx` | Orders section sidebar layout |
| `src/app/orders/page.tsx` | Server: fetch orders list, render OrdersClient |
| `src/app/orders/client.tsx` | Client: orders table with status badges + delete confirm |
| `src/app/orders/actions.ts` | `createWorkOrder` (redirect), `deleteWorkOrder` |
| `src/app/orders/[id]/page.tsx` | Server: fetch order + lines + models + colors |
| `src/app/orders/[id]/client.tsx` | Client: header, lines table, Add Line Dialog, Release form |
| `src/app/orders/[id]/form.tsx` | Client: LineForm (model/color/qty selects) |
| `src/app/orders/[id]/actions.ts` | `addLine`, `deleteLine`, `releaseOrderAction` |

**Modified files:**
| File | Change |
|---|---|
| `src/db/operations.ts` | Add `releaseWorkOrder(workOrderId, dbInstance?)` |
| `package.json` | Add `vitest` devDependency + `"test"` script |

---

## Task 1: `releaseWorkOrder` — tests + implementation

**Files:**
- Create: `vitest.config.ts`
- Create: `src/db/__tests__/release.test.ts`
- Modify: `src/db/operations.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `releaseWorkOrder(workOrderId: number, dbInstance?: typeof db): Promise<void>` — throws on invalid state

---

- [ ] **Step 1: Install Vitest**

```bash
npm install --save-dev vitest
```

Expected: vitest appears in `package.json` devDependencies.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': resolve(process.cwd(), './src') },
  },
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 3: Add test script to `package.json`**

In the `"scripts"` block, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write the failing tests**

Create `src/db/__tests__/release.test.ts`:

```ts
import { beforeAll, afterEach, describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from '@/db/schema';
import { releaseWorkOrder } from '@/db/operations';

const testClient = createClient({ url: ':memory:' });
const testDb = drizzle(testClient, { schema });

beforeAll(async () => {
  await testClient.execute('PRAGMA foreign_keys = ON');
  await migrate(testDb, { migrationsFolder: 'src/db/migrations' });
});

afterEach(async () => {
  // Delete in FK-safe order (children before parents)
  await testDb.delete(schema.workOrderOperation);
  await testDb.delete(schema.workOrderLine);
  await testDb.delete(schema.workOrder);
  await testDb.delete(schema.routingStep);
  await testDb.delete(schema.workCenter);
  await testDb.delete(schema.model);
  await testDb.delete(schema.department);
});

// Seeds one department, one work center, one model, one routing step.
// Returns their IDs for assertions.
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

  return { dept, wc, mdl, step };
}

describe('releaseWorkOrder', () => {
  it('creates one operation per line×step and flips status to RELEASED', async () => {
    const { mdl, wc, step } = await seedBase();

    const [wo] = await testDb
      .insert(schema.workOrder)
      .values({ orderNumber: 'PO-2026-001', status: 'DRAFT' })
      .returning({ id: schema.workOrder.id });

    const [line] = await testDb
      .insert(schema.workOrderLine)
      .values({ workOrderId: wo.id, modelId: mdl.id, quantity: 2 })
      .returning({ id: schema.workOrderLine.id });

    await releaseWorkOrder(wo.id, testDb);

    const ops = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.workOrderLineId, line.id));

    expect(ops).toHaveLength(1);
    expect(ops[0].workCenterId).toBe(wc.id);
    expect(ops[0].routingStepId).toBe(step.id);
    expect(ops[0].sequence).toBe(10);
    expect(ops[0].status).toBe('QUEUED');

    const [updated] = await testDb
      .select({ status: schema.workOrder.status, releasedAt: schema.workOrder.releasedAt })
      .from(schema.workOrder)
      .where(eq(schema.workOrder.id, wo.id));

    expect(updated.status).toBe('RELEASED');
    expect(updated.releasedAt).toBeTruthy();
  });

  it('throws if order is already RELEASED', async () => {
    const [wo] = await testDb
      .insert(schema.workOrder)
      .values({ orderNumber: 'PO-2026-002', status: 'RELEASED' })
      .returning({ id: schema.workOrder.id });

    await expect(releaseWorkOrder(wo.id, testDb)).rejects.toThrow('not in DRAFT');
  });

  it('throws naming the model when it has no routing steps', async () => {
    const [mdl] = await testDb
      .insert(schema.model)
      .values({ code: 'MDL-B', nameAr: 'نموذج ب', nameEn: 'Model B' })
      .returning({ id: schema.model.id });

    const [wo] = await testDb
      .insert(schema.workOrder)
      .values({ orderNumber: 'PO-2026-003', status: 'DRAFT' })
      .returning({ id: schema.workOrder.id });

    await testDb
      .insert(schema.workOrderLine)
      .values({ workOrderId: wo.id, modelId: mdl.id, quantity: 1 });

    await expect(releaseWorkOrder(wo.id, testDb)).rejects.toThrow('MDL-B');
  });

  it('throws if order has no lines', async () => {
    const [wo] = await testDb
      .insert(schema.workOrder)
      .values({ orderNumber: 'PO-2026-004', status: 'DRAFT' })
      .returning({ id: schema.workOrder.id });

    await expect(releaseWorkOrder(wo.id, testDb)).rejects.toThrow('no lines');
  });
});
```

- [ ] **Step 5: Run tests — verify they fail**

```bash
npm test
```

Expected: 4 failures like `Error: releaseWorkOrder is not a function` (function doesn't exist yet).

- [ ] **Step 6: Implement `releaseWorkOrder` in `src/db/operations.ts`**

Add these imports to the top of the file (merge with existing imports):

```ts
import { and, asc, eq } from 'drizzle-orm';
// Add to schema imports:
import {
  model,
  operationEvent,
  operationTransition,
  routingStep,
  workOrder,
  workOrderLine,
  workOrderOperation,
  type OperationEventType,
  type OperationStatus,
} from './schema';
```

Then add this function at the end of `src/db/operations.ts`:

```ts
/**
 * Releases a DRAFT work order: validates all lines have routing steps,
 * then in one transaction inserts work_order_operation rows (one per line × step)
 * and flips the work order status to RELEASED.
 *
 * Throws if: order not found, not DRAFT, has no lines, or any model lacks routing.
 * The optional dbInstance parameter exists for unit-test injection.
 */
export async function releaseWorkOrder(
  workOrderId: number,
  dbInstance: typeof db = db,
): Promise<void> {
  const [order] = await dbInstance
    .select({ id: workOrder.id, status: workOrder.status })
    .from(workOrder)
    .where(eq(workOrder.id, workOrderId));

  if (!order) throw new Error(`Work order ${workOrderId} not found`);
  if (order.status !== 'DRAFT') throw new Error('Work order is not in DRAFT status');

  const lines = await dbInstance
    .select({ id: workOrderLine.id, modelId: workOrderLine.modelId })
    .from(workOrderLine)
    .where(eq(workOrderLine.workOrderId, workOrderId));

  if (lines.length === 0) throw new Error('Cannot release a work order with no lines');

  // Pre-validate all models have routing — fail before writing anything
  const lineSteps: { lineId: number; steps: { id: number; workCenterId: number; sequence: number }[] }[] = [];

  for (const line of lines) {
    const [mdl] = await dbInstance
      .select({ code: model.code })
      .from(model)
      .where(eq(model.id, line.modelId));

    const steps = await dbInstance
      .select({
        id: routingStep.id,
        workCenterId: routingStep.workCenterId,
        sequence: routingStep.sequence,
      })
      .from(routingStep)
      .where(eq(routingStep.modelId, line.modelId))
      .orderBy(asc(routingStep.sequence));

    if (steps.length === 0) {
      throw new Error(
        `Model "${mdl?.code ?? String(line.modelId)}" has no routing steps — define routing before releasing`,
      );
    }

    lineSteps.push({ lineId: line.id, steps });
  }

  const now = new Date().toISOString();

  await dbInstance.transaction(async (tx) => {
    for (const { lineId, steps } of lineSteps) {
      for (const step of steps) {
        await tx.insert(workOrderOperation).values({
          workOrderLineId: lineId,
          workCenterId: step.workCenterId,
          routingStepId: step.id,
          sequence: step.sequence,
        });
      }
    }
    await tx
      .update(workOrder)
      .set({ status: 'RELEASED', releasedAt: now })
      .where(eq(workOrder.id, workOrderId));
  });
}
```

- [ ] **Step 7: Run tests — verify all 4 pass**

```bash
npm test
```

Expected output:
```
✓ src/db/__tests__/release.test.ts (4)
  ✓ releaseWorkOrder > creates one operation per line×step and flips status to RELEASED
  ✓ releaseWorkOrder > throws if order is already RELEASED
  ✓ releaseWorkOrder > throws naming the model when it has no routing steps
  ✓ releaseWorkOrder > throws if order has no lines

Test Files  1 passed (1)
Tests       4 passed (4)
```

- [ ] **Step 8: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add vitest.config.ts src/db/__tests__/release.test.ts src/db/operations.ts package.json package-lock.json
git commit -m "feat: add releaseWorkOrder with Vitest unit tests"
```

---

## Task 2: Orders layout + list page + create/delete actions

**Files:**
- Create: `src/app/orders/layout.tsx`
- Create: `src/app/orders/page.tsx`
- Create: `src/app/orders/client.tsx`
- Create: `src/app/orders/actions.ts`

**Interfaces:**
- Consumes: `workOrder`, `workOrderLine` from schema; `db` from db.ts
- Produces: `/orders/` route, `createWorkOrder()` server action (redirects to `/orders/[id]`), `deleteWorkOrder()` server action

---

- [ ] **Step 1: Create `src/app/orders/layout.tsx`**

```tsx
import Link from 'next/link';

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-52 bg-gray-900 text-white flex-shrink-0 flex flex-col">
        <div className="px-4 py-4 text-sm font-semibold tracking-wide text-gray-300 border-b border-gray-700">
          e-pop · Orders
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          <Link
            href="/orders"
            className="block px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            Work Orders
          </Link>
        </nav>
        <div className="px-4 py-3 border-t border-gray-700">
          <Link href="/admin" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            ← Master Data
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/orders/actions.ts`**

```ts
'use server';
import { desc, eq, like } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db/db';
import { workOrder } from '@/db/schema';

export async function createWorkOrder() {
  const year = new Date().getFullYear();
  const pattern = `PO-${year}-%`;

  let newId: number;

  const [inserted] = await db.transaction(async (tx) => {
    const [last] = await tx
      .select({ orderNumber: workOrder.orderNumber })
      .from(workOrder)
      .where(like(workOrder.orderNumber, pattern))
      .orderBy(desc(workOrder.orderNumber))
      .limit(1);

    const lastN = last ? parseInt(last.orderNumber.split('-')[2], 10) : 0;
    const nextN = String(lastN + 1).padStart(3, '0');
    const orderNumber = `PO-${year}-${nextN}`;

    return tx
      .insert(workOrder)
      .values({ orderNumber, status: 'DRAFT' })
      .returning({ id: workOrder.id });
  });

  newId = inserted.id;
  redirect(`/orders/${newId}`);
}

export async function deleteWorkOrder(formData: FormData) {
  const id = Number(formData.get('id'));

  const [order] = await db
    .select({ status: workOrder.status })
    .from(workOrder)
    .where(eq(workOrder.id, id));

  if (!order || order.status !== 'DRAFT') return;

  await db.delete(workOrder).where(eq(workOrder.id, id));
  revalidatePath('/orders');
}
```

- [ ] **Step 3: Create `src/app/orders/client.tsx`**

```tsx
'use client';
import Link from 'next/link';
import type { deleteWorkOrder } from './actions';
import type { WorkOrderStatus } from '@/db/schema';

type OrderRow = {
  id: number;
  orderNumber: string;
  status: WorkOrderStatus;
  createdAt: string;
  lineCount: number;
};

const STATUS_BADGE: Record<WorkOrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  RELEASED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
};

export function OrdersClient({
  orders,
  onDelete,
}: {
  orders: OrderRow[];
  onDelete: typeof deleteWorkOrder;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Order #</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Lines</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
            <th className="px-4 py-3 w-32" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                No work orders yet — click "+ New Work Order" to create one
              </td>
            </tr>
          )}
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900 font-mono">{o.orderNumber}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[o.status]}`}>
                  {o.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500">{o.lineCount}</td>
              <td className="px-4 py-3 text-gray-500 text-xs">{o.createdAt.slice(0, 10)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-3 justify-end items-center">
                  <Link
                    href={`/orders/${o.id}`}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    Open →
                  </Link>
                  {o.status === 'DRAFT' && (
                    <form action={onDelete} className="inline">
                      <input type="hidden" name="id" value={o.id} />
                      <button
                        type="submit"
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                        onClick={(e) => {
                          if (!confirm('Delete this work order?')) e.preventDefault();
                        }}
                      >
                        Delete
                      </button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/app/orders/page.tsx`**

```tsx
import { asc, count, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { workOrder, workOrderLine } from '@/db/schema';
import { OrdersClient } from './client';
import { createWorkOrder, deleteWorkOrder } from './actions';

export default async function OrdersPage() {
  const orders = await db
    .select({
      id: workOrder.id,
      orderNumber: workOrder.orderNumber,
      status: workOrder.status,
      createdAt: workOrder.createdAt,
      lineCount: count(workOrderLine.id),
    })
    .from(workOrder)
    .leftJoin(workOrderLine, eq(workOrderLine.workOrderId, workOrder.id))
    .groupBy(workOrder.id)
    .orderBy(asc(workOrder.createdAt));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Work Orders / أوامر العمل
        </h1>
        <form action={createWorkOrder}>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + New Work Order
          </button>
        </form>
      </div>
      <OrdersClient orders={orders} onDelete={deleteWorkOrder} />
    </div>
  );
}
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Start dev server and verify in browser**

```bash
npm run dev
```

Navigate to `http://localhost:3000/orders`. Verify:
- Sidebar shows "e-pop · Orders" with "Work Orders" link and "← Master Data" footer
- Table renders with "No work orders yet" empty state
- Clicking "+ New Work Order" creates `PO-2026-001`, redirects to `/orders/1` (shows 404 until Task 3)
- Navigating back to `/orders` shows the order with status DRAFT and 0 lines
- Delete button appears for DRAFT orders; confirm dialog appears; deleting removes it
- Creating two more orders: numbers sequence to `PO-2026-002`, `PO-2026-003`

- [ ] **Step 7: Commit**

```bash
git add src/app/orders/
git commit -m "feat: add orders layout, list page, and create/delete actions"
```

---

## Task 3: Order detail — lines + release + client

**Files:**
- Create: `src/app/orders/[id]/actions.ts`
- Create: `src/app/orders/[id]/form.tsx`
- Create: `src/app/orders/[id]/client.tsx`
- Create: `src/app/orders/[id]/page.tsx`

**Interfaces:**
- Consumes: `releaseWorkOrder` from `src/db/operations.ts`; `workOrder`, `workOrderLine`, `model`, `color` from schema
- Produces: `/orders/[id]` route — detail page with line management and Release button

---

- [ ] **Step 1: Create `src/app/orders/[id]/actions.ts`**

```ts
'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { workOrder, workOrderLine } from '@/db/schema';
import { releaseWorkOrder } from '@/db/operations';

export async function addLine(_prev: unknown, formData: FormData) {
  const workOrderId = Number(formData.get('workOrderId'));
  const modelId = Number(formData.get('modelId'));
  const colorIdRaw = formData.get('colorId');
  const colorId = colorIdRaw && colorIdRaw !== '' ? Number(colorIdRaw) : null;
  const quantity = Math.max(1, Number(formData.get('quantity')) || 1);

  try {
    const [order] = await db
      .select({ status: workOrder.status })
      .from(workOrder)
      .where(eq(workOrder.id, workOrderId));

    if (!order || order.status !== 'DRAFT') {
      return { error: 'Cannot modify a released order' };
    }

    await db.insert(workOrderLine).values({ workOrderId, modelId, colorId, quantity });
    revalidatePath(`/orders/${workOrderId}`);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteLine(formData: FormData) {
  const lineId = Number(formData.get('lineId'));
  const workOrderId = Number(formData.get('workOrderId'));

  const [order] = await db
    .select({ status: workOrder.status })
    .from(workOrder)
    .where(eq(workOrder.id, workOrderId));

  if (!order || order.status !== 'DRAFT') return;

  await db.delete(workOrderLine).where(eq(workOrderLine.id, lineId));
  revalidatePath(`/orders/${workOrderId}`);
}

export async function releaseOrderAction(_prev: unknown, formData: FormData) {
  const id = Number(formData.get('id'));
  try {
    await releaseWorkOrder(id);
    revalidatePath(`/orders/${id}`);
    revalidatePath('/orders');
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
```

- [ ] **Step 2: Create `src/app/orders/[id]/form.tsx`**

```tsx
'use client';
import { useActionState, useEffect } from 'react';
import { SelectField } from '@/components/admin/SelectField';
import { FormField } from '@/components/admin/FormField';
import type { addLine } from './actions';

type Model = { id: number; code: string; nameEn: string };
type Color = { id: number; code: string; nameEn: string };

export function LineForm({
  workOrderId,
  models,
  colors,
  onSuccess,
  onAddLine,
}: {
  workOrderId: number;
  models: Model[];
  colors: Color[];
  onSuccess: () => void;
  onAddLine: typeof addLine;
}) {
  const [state, formAction, pending] = useActionState(onAddLine, null);

  useEffect(() => {
    if (state && 'success' in state) onSuccess();
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <SelectField
        label="Model / النموذج"
        name="modelId"
        required
        options={models.map((m) => ({ value: m.id, label: `${m.code} — ${m.nameEn}` }))}
      />
      <SelectField
        label="Color / اللون (optional)"
        name="colorId"
        options={colors.map((c) => ({ value: c.id, label: `${c.code} — ${c.nameEn}` }))}
      />
      <FormField
        label="Quantity / الكمية"
        name="quantity"
        type="number"
        defaultValue="1"
        min="1"
        required
      />
      {state && 'error' in state && (
        <p className="text-red-500 text-sm mb-3">{state.error}</p>
      )}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Adding…' : 'Add Line / إضافة'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create `src/app/orders/[id]/client.tsx`**

```tsx
'use client';
import { useState, useActionState } from 'react';
import Link from 'next/link';
import { Dialog } from '@/components/ui/Dialog';
import { LineForm } from './form';
import type { InferSelectModel } from 'drizzle-orm';
import type { workOrder } from '@/db/schema';
import type { WorkOrderStatus } from '@/db/schema';
import type { addLine, deleteLine, releaseOrderAction } from './actions';

type Order = InferSelectModel<typeof workOrder>;
type Line = {
  id: number;
  modelId: number;
  modelCode: string;
  modelNameEn: string;
  colorId: number | null;
  colorNameEn: string | null;
  quantity: number;
};
type Model = { id: number; code: string; nameEn: string };
type Color = { id: number; code: string; nameEn: string };

const STATUS_BADGE: Record<WorkOrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  RELEASED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
};

export function OrderDetailClient({
  order,
  lines,
  models,
  colors,
  onAddLine,
  onDeleteLine,
  onRelease,
}: {
  order: Order;
  lines: Line[];
  models: Model[];
  colors: Color[];
  onAddLine: typeof addLine;
  onDeleteLine: typeof deleteLine;
  onRelease: typeof releaseOrderAction;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [releaseState, releaseAction] = useActionState(onRelease, null);
  const isDraft = order.status === 'DRAFT';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <Link href="/orders" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Orders
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-semibold text-gray-900 font-mono">{order.orderNumber}</h1>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[order.status]}`}
        >
          {order.status}
        </span>
        {isDraft && (
          <div className="ml-auto flex flex-col items-end gap-1">
            <form action={releaseAction}>
              <input type="hidden" name="id" value={order.id} />
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Release →
              </button>
            </form>
            {releaseState?.error && (
              <p className="text-red-500 text-xs max-w-xs text-right">{releaseState.error}</p>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-6">
        Created {order.createdAt.slice(0, 10)}
        {order.releasedAt && ` · Released ${order.releasedAt.slice(0, 10)}`}
      </p>

      {/* Lines */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">Lines / بنود</h2>
        {isDraft && (
          <button
            onClick={() => setDialogOpen(true)}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-blue-700 transition-colors"
          >
            + Add Line
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Model / النموذج
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Color / اللون
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">
                Qty
              </th>
              {isDraft && <th className="px-4 py-3 w-16" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.length === 0 && (
              <tr>
                <td
                  colSpan={isDraft ? 4 : 3}
                  className="px-4 py-10 text-center text-sm text-gray-400"
                >
                  No lines yet — click "+ Add Line" to add models to this order
                </td>
              </tr>
            )}
            {lines.map((line) => (
              <tr key={line.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {line.modelCode} — {line.modelNameEn}
                </td>
                <td className="px-4 py-3 text-gray-600">{line.colorNameEn ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700">{line.quantity}</td>
                {isDraft && (
                  <td className="px-4 py-3">
                    <form action={onDeleteLine} className="inline">
                      <input type="hidden" name="lineId" value={line.id} />
                      <input type="hidden" name="workOrderId" value={order.id} />
                      <button
                        type="submit"
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                        onClick={(e) => {
                          if (!confirm('Delete this line?')) e.preventDefault();
                        }}
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Add Line / إضافة بند"
      >
        <LineForm
          key={dialogOpen ? 'open' : 'closed'}
          workOrderId={order.id}
          models={models}
          colors={colors}
          onSuccess={() => setDialogOpen(false)}
          onAddLine={onAddLine}
        />
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/app/orders/[id]/page.tsx`**

```tsx
import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/db';
import { color, model, workOrder, workOrderLine } from '@/db/schema';
import { OrderDetailClient } from './client';
import { addLine, deleteLine, releaseOrderAction } from './actions';

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);

  const [order] = await db.select().from(workOrder).where(eq(workOrder.id, id));
  if (!order) notFound();

  const [lines, models, colors] = await Promise.all([
    db
      .select({
        id: workOrderLine.id,
        modelId: workOrderLine.modelId,
        modelCode: model.code,
        modelNameEn: model.nameEn,
        colorId: workOrderLine.colorId,
        colorNameEn: color.nameEn,
        quantity: workOrderLine.quantity,
      })
      .from(workOrderLine)
      .innerJoin(model, eq(model.id, workOrderLine.modelId))
      .leftJoin(color, eq(color.id, workOrderLine.colorId))
      .where(eq(workOrderLine.workOrderId, id))
      .orderBy(asc(workOrderLine.id)),

    db
      .select({ id: model.id, code: model.code, nameEn: model.nameEn })
      .from(model)
      .orderBy(asc(model.code)),

    db
      .select({ id: color.id, code: color.code, nameEn: color.nameEn })
      .from(color)
      .orderBy(asc(color.code)),
  ]);

  return (
    <OrderDetailClient
      order={order}
      lines={lines}
      models={models}
      colors={colors}
      onAddLine={addLine}
      onDeleteLine={deleteLine}
      onRelease={releaseOrderAction}
    />
  );
}
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: End-to-end test in browser**

With the dev server running, test this full flow:

1. Navigate to `/orders` → click "+ New Work Order" → lands on detail page (empty lines, status DRAFT)
2. Click "Release →" with no lines → error shows inline: "Cannot release a work order with no lines"
3. Click "+ Add Line" → Dialog opens; select a model (must have routing steps in your dev DB), optional color, qty → "Add Line" → line appears in table
4. Click "Release →" → if model has no routing steps, error names the model; otherwise order flips to RELEASED
5. After release: buttons ("+ Add Line", Delete, "Release →") all disappear; status badge shows blue RELEASED; "Released [date]" shows in header
6. Navigate back to `/orders` → order shows as RELEASED with correct line count
7. Create a second order with a model that has NO routing steps → Release shows: `Model "XYZ" has no routing steps — define routing before releasing`

- [ ] **Step 7: Run tests one final time**

```bash
npm test
```

Expected: 4 passed.

- [ ] **Step 8: Commit**

```bash
git add src/app/orders/[id]/
git commit -m "feat: add order detail, line management, and release action"
```
