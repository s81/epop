# Production Order + Release — Design Spec

**Date:** 2026-06-24  
**Phase:** 3 (of 8)  
**Status:** Approved, ready for implementation

---

## What we're building

Work order CRUD (header + lines in DRAFT state) and a Release action that explodes each line's routing into `work_order_operation` rows — one per line × routing step. This is the connective tissue that makes operations exist on the shop floor.

---

## Decisions made

| Question | Decision | Reason |
|---|---|---|
| Navigation placement | New `/orders/` route with its own layout | Work orders are transactional, not master data; avoids retrofitting when tablet UI arrives in Phase 4 |
| Release logic location | `releaseWorkOrder()` in `src/db/operations.ts` | Architecture invariant: all state-changing business logic lives in the service layer alongside `applyEvent()` |
| Model with 0 routing steps on release | Fail entirely with named error | Silent skip means items disappear from the shop floor with no traceability |
| Color on a line | Optional (nullable `color_id`) | Unpainted/uncolored pieces are valid production items |

---

## Routes & files

```
src/app/orders/
  layout.tsx          ← sidebar: "e-pop · Orders", single nav link for now
  page.tsx            ← server: work order list
  actions.ts          ← createWorkOrder, deleteWorkOrder (DRAFT only)
  [id]/
    page.tsx          ← server: order detail (header + lines)
    client.tsx        ← client: Add Line Dialog + Release button
    actions.ts        ← addLine, deleteLine, releaseWorkOrder (calls operations.ts)

src/db/operations.ts  ← add releaseWorkOrder() alongside existing applyEvent()
```

---

## Data flow

### Creating a work order

`createWorkOrder()` server action (in `src/app/orders/actions.ts`):
1. Inside a transaction, query `MAX(order_number)` filtered to `PO-{year}-%`
2. Parse suffix, increment, zero-pad to 3 digits → `PO-2026-001`
3. Insert `work_order` row with status `DRAFT`
4. `redirect('/orders/[newId]')`

### Adding a line

`addLine()` server action (`src/app/orders/[id]/actions.ts`):
- Validates order is DRAFT, inserts `work_order_line` (modelId, colorId?, quantity)
- `revalidatePath('/orders/[id]')`

### Deleting a line

`deleteLine()` — only allowed on DRAFT orders. Cascades via FK to any future operations (none exist pre-release).

### Releasing

`releaseWorkOrder(workOrderId)` in `src/db/operations.ts`:

```
1. Fetch work_order — throw if not found or status ≠ DRAFT
2. Fetch all work_order_lines for this order
3. For each line:
     fetch routing_steps WHERE model_id = line.modelId ORDER BY sequence
     if steps.length === 0:
       throw Error(`Model "${model.code}" has no routing steps — define routing before releasing`)
4. db.transaction():
     for each line:
       for each routing step of that line's model:
         INSERT work_order_operation (work_order_line_id, work_center_id, routing_step_id, sequence, status='QUEUED')
     UPDATE work_order SET status='RELEASED', released_at=now WHERE id=workOrderId
5. return void
```

The server action wraps this in try/catch and returns `{ error }` for the UI to display inline.

---

## UI

### `/orders/` — list

- Table: Order Number | Status badge | Lines | Created | "Open →" link
- Status badge colours: DRAFT=gray, RELEASED=blue, IN_PROGRESS=amber, COMPLETED=green
- "New Work Order" button top-right — single click, no modal; calls `createWorkOrder()` and redirects

### `/orders/[id]` — detail

**Header area:**
- Order number (large), status badge, Created timestamp
- Scheduled Start / Scheduled End (text inputs, editable in DRAFT only)
- "Release" button — top-right, shown only when DRAFT; on error shows message inline, order stays DRAFT

**Lines table:**
- Columns: Model | Color | Qty | (Delete button — hidden when not DRAFT)
- "+ Add Line" button — shown only when DRAFT; opens Dialog

**Add Line Dialog:**
- Model dropdown (required) — all models from DB
- Color dropdown (optional) — all colors from DB, with a blank "— no color —" option
- Qty number input (required, min 1)

**Released state:**
- All edit controls hidden
- Lines table read-only
- "Released at: …" timestamp shown below the status badge

---

## Error handling

| Scenario | Behaviour |
|---|---|
| Release: model has no routing steps | Error returned to client, displayed inline below Release button; order stays DRAFT |
| Release: order already RELEASED | Server action guard: return `{ error: 'Order is already released' }` |
| Add line: model not found | Drizzle FK error caught, returned as `{ error }` |
| Delete line on non-DRAFT order | Server action guard: return `{ error: 'Cannot modify a released order' }` |

---

## Conventions followed

- All patterns match existing admin pages (Dialog modal, `'use server'` actions, FormData, `revalidatePath`)
- No raw `UPDATE` from the UI — release goes through `operations.ts`
- Timestamps: ISO-8601 UTC text
- Bilingual: every visible label gets Arabic + English (same pattern as master data pages)
