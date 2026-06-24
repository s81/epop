# Tablet Work-Center Screen — Design Spec

**Date:** 2026-06-24
**Phase:** 4 (of 8)
**Status:** Approved, ready for implementation

---

## What we're building

A touch-first, RTL Arabic tablet screen for shop-floor operators. One URL per work center (`/tablet/[workCenterId]`) shows the open-operation queue for that work center, large action buttons that drive the FSM via `applyEvent()`, a live event feed, and operator badge ID entry. A landing page at `/tablet` lists all work centers for navigation.

---

## Decisions made

| Question | Decision | Reason |
|---|---|---|
| Live update strategy | Polling — `router.refresh()` every 8 seconds | Simple, no extra infra; ops change at human speed |
| Queue interaction | Full queue visible; active (top) op has big buttons; rest are read-only list | Operators see context while acting on current item |
| Work center navigation | `/tablet/[workCenterId]` + `/tablet` landing page | Tablets bookmark their URL; landing page for flexibility |
| Operator identity | Simple badge ID text input in header, stored in tab state | Deferred auth (Phase 4 pre-auth); stored in `operatorId` field |

---

## Routes & Files

```
src/app/tablet/
  layout.tsx              ← full-screen dark layout, no sidebar
  page.tsx                ← server: list all work centers
  [workCenterId]/
    page.tsx              ← server: fetch queue + recent events → TabletClient
    client.tsx            ← 'use client': polling, operator ID, action forms
    actions.ts            ← 'use server': applyEventAction → applyEvent()
```

No API routes. No new dependencies.

---

## Data Flow

### Queue query (hits `ix_op_open` partial index)

```sql
SELECT woo.id, woo.sequence, woo.status,
       m.name_ar, m.name_en, m.code,
       wo.order_number,
       wol.quantity
FROM work_order_operation woo
JOIN work_order_line wol ON wol.id = woo.work_order_line_id
JOIN work_order wo        ON wo.id  = wol.work_order_id
JOIN model m              ON m.id   = wol.model_id
WHERE woo.work_center_id = ?
  AND woo.status IN ('QUEUED', 'IN_PROGRESS', 'PAUSED')
ORDER BY woo.sequence ASC
```

First row = active operation (big card + buttons). Remaining rows = upcoming queue list.

### Event feed query

```sql
SELECT oe.event_type, oe.operator_id, oe.occurred_at,
       m.name_ar, m.code
FROM operation_event oe
JOIN work_order_operation woo ON woo.id = oe.operation_id
JOIN work_order_line wol      ON wol.id = woo.work_order_line_id
JOIN model m                  ON m.id   = wol.model_id
WHERE woo.work_center_id = ?
ORDER BY oe.occurred_at DESC
LIMIT 15
```

### Polling

`TabletClient` runs `setInterval(() => router.refresh(), 8000)` in `useEffect` (cleanup on unmount). Re-runs the server page, re-queries both tables, pushes new props to client. Clears any stale error state on each new prop set.

### Mutation flow

1. Operator enters badge ID in header field (stored in `useState`, persists in-tab for the shift)
2. Taps action button → `<form action={applyEventAction}>` submits with hidden fields: `operationId`, `eventType`, `operatorId`
3. `applyEventAction` calls `applyEvent(operationId, eventType, { operatorId })`
4. On success: `revalidatePath('/tablet/[workCenterId]')`, return `null`
5. On error: return `{ error: string }` — shown inline below buttons
6. `router.refresh()` fires immediately after successful action (don't wait for next poll interval)

---

## UI Layout

### `/tablet` — work center selector

Dark full-screen page. Title "e-pop · اختر محطة العمل / Select Work Center". Grid of large tappable cards, one per work center: Arabic name (large), English name + code (small below). Tap navigates to `/tablet/[workCenterId]`.

### `/tablet/[workCenterId]` — tablet screen

**Direction:** `dir="rtl"` on the main content area.
**Background:** `bg-gray-950 text-white`, full viewport height.

**Header strip:**
- Right: work center name AR (`text-xl font-bold`) + EN + code (`text-sm text-gray-400`)
- Left: operator ID input — `placeholder="رقم الموظف / Badge ID"`, `className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm w-48"`. If empty when action tapped: highlight with red border, do not submit.

**Active operation card (top ~45vh, prominent):**
- `bg-gray-800 rounded-2xl p-6`
- Model name in Arabic — `text-4xl font-bold` (primary)
- Order number + sequence — `text-sm text-gray-400` below
- Status badge — colored pill
- Action buttons — full-width row, `min-h-[72px] text-xl font-bold rounded-xl`:

| Current status | Buttons |
|---|---|
| `QUEUED` | **بدء / Start** `bg-green-600 hover:bg-green-500` |
| `IN_PROGRESS` | **إيقاف / Pause** `bg-amber-500 hover:bg-amber-400` · **إنهاء / Finish** `bg-blue-600 hover:bg-blue-500` |
| `PAUSED` | **استئناف / Resume** `bg-green-600 hover:bg-green-500` |
| `PENDING_QC` | **قبول / Accept** `bg-green-600 hover:bg-green-500` · **رفض / Reject** `bg-red-600 hover:bg-red-500` |

- Error message: `text-red-400 text-sm mt-2` below buttons, cleared on next refresh

**Queue list (scrollable, ~35vh):**
Heading: "الطابور / Queue". Compact rows: sequence number · model name AR · order number · status badge. Read-only — no buttons. `bg-gray-900 rounded-xl`.

**Event feed (bottom strip, `max-h-40`, overflow-y-auto):**
Heading: "السجل / Log". Rows: `occurred_at` (time only, `HH:MM`) · event type badge · operator ID · model name AR. Most recent at top.

---

## FSM Button Logic

Derived from `operation_transition` seed rows — no if/else in code, but buttons are rendered conditionally per status:

```
QUEUED      → show [START]
IN_PROGRESS → show [PAUSE, FINISH]
PAUSED      → show [RESUME]
PENDING_QC  → show [ACCEPT, REJECT]
COMPLETED   → no buttons (won't appear in queue due to ix_op_open filter)
REJECTED    → no buttons (same)
```

Each button is its own `<form>` with `action={applyEventAction}` and hidden inputs `operationId`, `eventType`, `operatorId`.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `IllegalTransition` (race — another tablet already acted) | Inline: "الحالة تغيّرت / Status changed — refreshing" + immediate `router.refresh()` |
| Operation not found | Inline: "العملية غير موجودة / Operation not found" |
| No operator ID when button tapped | Client guard: red border on input, no submit |
| Empty queue | Centred message: "لا توجد عمليات مفتوحة / No open operations" |
| Work center not found (bad URL) | `notFound()` |
| Transient poll failure | Silent — next poll retries; no UI change |

Error state auto-clears when new props arrive from the next `router.refresh()`.

---

## Conventions followed

- Pattern: server page fetches → passes to `'use client'` component (same as orders, admin)
- All FSM mutations go through `applyEvent()` in `operations.ts` — no raw UPDATEs
- `revalidatePath` called after every mutation
- No auth gate (deferred — see CLAUDE.md; must be added before network deployment)
- Bilingual: every visible label Arabic + English
- Touch targets: minimum 72px height on action buttons
