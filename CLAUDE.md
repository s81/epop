# e-pop — Claude Code project context

Web MES for Maani (office-furniture manufacturer, Jordan). Replaces a legacy
SQL Server desktop app (e-pop). Lightweight Odoo-MRP-style: production orders →
work-center execution on shop-floor tablets, with maintenance + quality feedback.

## Stack
- DB: **Turso (libSQL / SQLite) + Drizzle ORM**
- Frontend/API framework: **Next.js 15 (App Router)**. All state changes MUST go
  through the service layer (`applyEvent` in `operations.ts`), never raw UPDATEs from the UI.

## Architecture — already designed, do NOT redesign
- Execution is a **data-driven state machine**. Operations move only via rows in
  `operation_transition`. Add a behavior = INSERT a row, never hard-code if/else.
- Every shop-floor tablet action = one call to `applyEvent()` (validate move →
  append event → update status + timestamp, all in one transaction).
- `operation_event` is an append-only log = audit trail + live feed + the hook
  that maintenance & quality attach to.
- Core files: `src/db/schema.ts`, `src/db/operations.ts`, `src/db/db.ts`,
  `src/db/migrations/0000_misty_khan.sql`. Read them before building anything.

## Build order — dependency-driven, do NOT reorder
Status: Phase 0 schema ✅ · Phase 1 backend engine ✅ · Phase 1a master data CRUD = TODO · everything below = TODO

1. ✅ **Schema + migration** — all spine tables, FSM seed rows, `ix_op_open` index.
   (`src/db/schema.ts` + `src/db/migrations/0000_misty_khan.sql`)
2. ✅ **Backend engine** — `applyEvent()` state machine, `IllegalTransition` error.
   (`src/db/operations.ts`, `src/db/db.ts`)
3. **Master data CRUD** — departments, work_centers, models, color_families,
   colors. (Legacy tables: Departments, Machines, Models, ColorFamilies, Colors.)
4. **Routing** — model → ordered steps (work_center, sequence, man_time,
   machine_time, setup/mco). (Legacy: ModelMachines + MCOs.)
5. **Production order + release** — production order with lines (DRAFT → RELEASED
   → IN_PROGRESS → COMPLETED). Releasing **explodes each model's routing into
   `work_order_operation` rows** (one per model × routing step). This is the
   connective tissue that makes operations exist — build it carefully and test it.
6. **Tablet work-center screen** (the headline) — one screen per work center:
   its open-operation queue (use `ix_op_open`), large touch Start/Pause/Finish/
   Accept/Reject buttons → `applyEvent`, and a live event feed. Touch-first, RTL.
7. **Maintenance + quality** (Phase 2) — `maintenance_request` + `quality_defect`
   tables referencing `operation_event`; tablet buttons to raise them. The reject
   path is already wired through the FSM.
8. **Scheduler** (Phase 3) — port legacy `SimulationPlans`: finite-capacity
   dispatch using work_center capacity/buffer + shift calendar + routing times.
   Hardest piece; do it LAST and validate against real Phase 1–2 data.

## Security — NOT YET IMPLEMENTED
- All `/admin/*` server actions have **no auth gate**. They are independently
  callable HTTP endpoints — anyone who can reach the server can mutate master data.
- Before deploying to a networked environment, add:
  1. `middleware.ts` guarding `/admin/*` (redirect unauthenticated to `/login`)
  2. A `requireAdmin()` helper called at the top of every `actions.ts` function
  3. An auth system (NextAuth / Clerk / custom) with a user/session model
- Deferred deliberately — no auth design exists yet. Do this before Phase 4 (tablet UI).

## Conventions / gotchas
- Enable FK enforcement (`PRAGMA foreign_keys = ON;`) on the connection or
  `ON DELETE CASCADE` won't fire. It's in `db.ts`.
- Enums are TS unions in `schema.ts`; DB CHECK constraints live in the `.sql`
  migration. Keep the two in sync.
- Timestamps: TEXT ISO-8601 (UTC). Order numbers: `PO-YYYY-NNN`, server-generated,
  sequential per year.
- Bilingual UI: every label Arabic + English; legacy floor is RTL Arabic.

## Legacy → new mapping (reference)
Machines → work_center · WorkOrders → work_order ·
MachineTransactions_Live → work_order_operation ·
MachineTransactionsLog_Live → operation_event ·
ModelMachines / MCOs → routing · SimulationPlans → scheduler.
