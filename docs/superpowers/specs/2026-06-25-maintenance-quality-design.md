# Maintenance & Quality — Phase 5 Design

**Date:** 2026-06-25  
**Status:** Approved  
**Scope:** Tablet-side capture of maintenance requests and quality defects + admin list views

---

## Context

Phase 4 delivered the tablet work-center screen with FSM buttons (Start / Pause / Resume / Finish / Accept / Reject). The REJECT → REJECTED transition is already wired in the FSM. Phase 5 adds two side-channel record types that hang off shop-floor events, and lightweight admin views so supervisors can see what has been reported.

---

## What is NOT in scope

- Maintenance workflow (assign to technician, track repair time) — build after real operational data exists
- Rework work orders triggered by quality rejects
- Quality defect editing or resolution
- Auth gating (deferred per CLAUDE.md)

---

## Data Model

### `maintenance_request`

```sql
CREATE TABLE maintenance_request (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  work_center_id  INTEGER NOT NULL REFERENCES work_center(id),
  operation_id    INTEGER REFERENCES work_order_operation(id),  -- nullable
  category    TEXT NOT NULL CHECK (category IN ('MECHANICAL','ELECTRICAL','TOOLING','OTHER')),
  note        TEXT,
  reported_by TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')),
  resolved_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

- `operation_id` is nullable — a machine can fail with no active operation
- `resolved_at` is set server-side when status flips to RESOLVED
- Records are never deleted (audit trail)

### `quality_defect`

```sql
CREATE TABLE quality_defect (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id      INTEGER NOT NULL REFERENCES work_order_operation(id),
  operation_event_id INTEGER NOT NULL REFERENCES operation_event(id),
  category          TEXT NOT NULL CHECK (category IN ('DIMENSIONAL','SURFACE','ASSEMBLY','OTHER')),
  reported_by       TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

- `operation_event_id` references the REJECT event row specifically (per architecture spec)
- Immutable after creation — no update or delete

### Drizzle schema additions (`src/db/schema.ts`)

New TS union enums:
```ts
export const MAINTENANCE_CATEGORIES = ['MECHANICAL','ELECTRICAL','TOOLING','OTHER'] as const;
export type MaintenanceCategory = (typeof MAINTENANCE_CATEGORIES)[number];

export const MAINTENANCE_STATUSES = ['OPEN','RESOLVED'] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const QUALITY_DEFECT_CATEGORIES = ['DIMENSIONAL','SURFACE','ASSEMBLY','OTHER'] as const;
export type QualityDefectCategory = (typeof QUALITY_DEFECT_CATEGORIES)[number];
```

---

## Migration

New file: `src/db/migrations/0001_maintenance_quality.sql`

Contains DDL for both tables. Migration is additive — no changes to existing tables.

---

## Tablet UI

### Maintenance button

Location: tablet footer, right side (RTL → visually left), always visible.

```
[ ← محطات العمل / Work Centers ]     [ ⚠ إبلاغ عن عطل / Report Maintenance ]
```

Tapping opens a `<ConfirmModal>` overlay:
- Title: "نوع العطل / Problem Type"
- 2×2 grid of large touch buttons:
  - ميكانيكي / Mechanical
  - كهربائي / Electrical  
  - أدوات / Tooling
  - أخرى / Other
- Optional text field: "ملاحظات / Notes"
- Row of two buttons: "تأكيد / Confirm" (disabled until category selected) + "إلغاء / Cancel"

On confirm: calls `reportMaintenanceAction(FormData)` server action with workCenterId, operationId (`queue[0]?.id ?? null` — the currently active op from tablet state, or null if queue is empty), category, note, operatorId (badge ID from header).

### Reject flow (PENDING_QC → REJECTED)

Current behavior: Reject button fires `applyEventAction` immediately.

New behavior: Reject button opens a `<ConfirmModal>` overlay:
- Title: "سبب الرفض / Defect Type"
- 2×2 grid of large touch buttons:
  - أبعاد / Dimensional
  - سطح / Surface + Paint
  - تجميع / Assembly
  - أخرى / Other
- Row: "تأكيد / Confirm" (disabled until category selected) + "إلغاء / Cancel"
- Cancel: dismiss overlay, operation stays in PENDING_QC

On confirm: calls `rejectWithDefectAction(FormData)` server action with operationId, defectCategory, operatorId.

### `rejectWithDefectAction` — sequencing

`applyEvent` already runs its own internal transaction; libSQL/SQLite does not support nested transactions. Two sequential transactions are used:

1. `applyEvent(operationId, 'REJECT', { operatorId })` — returns `{ toStatus, eventId }`
2. Immediately after: insert `quality_defect` row referencing the event id

If step 1 fails, nothing is written. If step 2 fails, the REJECT event stands (correct state) but the quality_defect record is missing — log the error but do not roll back the reject. The FSM state change is the critical operation.

**applyEvent extension:** Add `eventId: number` to the return type. The insert into `operation_event` already happens inside the transaction; capture `result.lastInsertRowid` from that insert.

### `<ConfirmModal>` component

Shared component parameterized by:
```ts
type ModalProps = {
  title: string;
  categories: { value: string; labelAr: string; labelEn: string }[];
  noteField?: boolean;
  onConfirm: (category: string, note?: string) => void;
  onCancel: () => void;
};
```

Location: `src/app/tablet/[workCenterId]/ConfirmModal.tsx` (client component, inline overlay).

---

## Admin Views

### `/admin/maintenance`

**Query:** All maintenance_request rows joined to work_center, ordered by created_at DESC.

**UI:**
- Filter bar: All / Open / Resolved (client-side filter on the fetched list)
- Table columns: Work Center (Ar · code), Category badge, Note (truncated 60 chars), Reporter, Time (ISO timestamp), Status chip
- OPEN rows: "Mark Resolved / تم الحل" button → `resolveMaintenanceAction(id)` server action
- No delete

**File:** `src/app/admin/maintenance/page.tsx` + `actions.ts`

### `/admin/quality`

**Query:** All quality_defect rows joined to work_order_operation → work_order_line → work_order + model + work_center, ordered by created_at DESC.

**UI:**
- Table columns: Order Number, Model (Ar · code), Work Center, Defect Category badge, Reporter, Time
- Read-only — no actions

**File:** `src/app/admin/quality/page.tsx`

Both pages use the existing `/admin` layout (`src/app/admin/layout.tsx`).

---

## Server Actions Summary

| Action | File | Description |
|---|---|---|
| `reportMaintenanceAction` | `tablet/[workCenterId]/actions.ts` | Insert maintenance_request |
| `rejectWithDefectAction` | `tablet/[workCenterId]/actions.ts` | applyEvent(REJECT) + insert quality_defect in one tx |
| `resolveMaintenanceAction` | `admin/maintenance/actions.ts` | Flip status OPEN→RESOLVED, set resolved_at |

---

## applyEvent Return Type Extension

Current: `Promise<{ toStatus: OperationStatus }>`  
New: `Promise<{ toStatus: OperationStatus; eventId: number }>`

The `operation_event` insert is already inside the transaction. Capture `result.lastInsertRowid` and include it in the return value. This is a non-breaking additive change — existing callers ignore the extra field.

---

## File Checklist

**New files:**
- `src/db/migrations/0001_maintenance_quality.sql`
- `src/app/tablet/[workCenterId]/ConfirmModal.tsx`
- `src/app/admin/maintenance/page.tsx`
- `src/app/admin/maintenance/actions.ts`
- `src/app/admin/quality/page.tsx`

**Modified files:**
- `src/db/schema.ts` — add two tables + three enums
- `src/db/operations.ts` — extend applyEvent return type
- `src/app/tablet/[workCenterId]/actions.ts` — add reportMaintenanceAction, rejectWithDefectAction
- `src/app/tablet/[workCenterId]/client.tsx` — add maintenance button + reject modal flow
