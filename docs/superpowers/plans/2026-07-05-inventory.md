# Inventory / Materials — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement tasks. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add material master data (categories + SKUs) and a stock transaction ledger for receipts, issues, and adjustments.

**Architecture:** `material_category`, `material`, and `stock_transaction` tables. Stock levels computed via `SUM(quantity) GROUP BY material_id`. Admin UI: materials CRUD, inventory overview with current stock, transaction log.

**Tech Stack:** Next.js 15 App Router · Drizzle ORM · libSQL · Vitest

## Global Constraints

- All timestamps stored as TEXT in UTC (existing convention)
- Drizzle table definitions in `src/db/schema.ts`; raw DDL in migration files
- Server actions start with `'use server'` and return structured responses
- Bilingual labels on all UI: Arabic / English
- Tests use `file::memory:?cache=shared` in-memory libSQL
- Auth guarded by `requireRole('DATA_ENTRY')` on mutating actions; `requireRole('ADMIN')` on material/category delete

---

## File Map

**New:**
- `src/db/migrations/0006_materials.sql`
- `src/app/admin/materials/page.tsx`
- `src/app/admin/materials/actions.ts`
- `src/app/admin/materials/client.tsx`
- `src/app/admin/inventory/page.tsx`
- `src/app/admin/inventory/actions.ts`
- `src/app/admin/inventory/client.tsx`

**Modified:**
- `src/db/schema.ts` — add `materialCategory`, `material`, `stockTransaction` tables
- `src/db/migrations/meta/_journal.json` — add migration 0006 entry
- `src/app/admin/layout.tsx` — add Materials + Inventory nav links
- `scripts/seed.ts` — demo materials + transactions

---

### Task 1: Schema + migration

- [ ] **Step 1: Add tables to schema.ts**

Add `materialCategory`, `material`, and `stockTransaction` tables following the existing conventions.

- [ ] **Step 2: Create 0006_materials.sql**

```sql
CREATE TABLE IF NOT EXISTS material_category (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS material (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  category_id INTEGER NOT NULL REFERENCES material_category(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS stock_transaction (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id INTEGER NOT NULL REFERENCES material(id),
  type TEXT NOT NULL CHECK (type IN ('RECEIPT','ISSUE','ADJUSTMENT')),
  quantity REAL NOT NULL,
  reference TEXT,
  work_order_id INTEGER REFERENCES work_order(id),
  note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_stock_tx_material ON stock_transaction(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_tx_work_order ON stock_transaction(work_order_id);
```

- [ ] **Step 3: Update _journal.json**

Add entry for migration 0006.

- [ ] **Step 4: Run migration**

```bash
npx tsx scripts/migrate.ts
```

- [ ] **Step 5: Commit**

```
git add src/db/schema.ts src/db/migrations/
git commit -m "feat: add material_category, material, and stock_transaction tables"
```

---

### Task 2: Materials admin CRUD page

- [ ] **Step 1: Implement server actions**

```ts
createMaterial(prev, formData): requireRole('ADMIN'), insert material, revalidatePath
updateMaterial(prev, formData): requireRole('ADMIN'), update material by id, revalidatePath
deleteMaterial(prev, formData): requireRole('ADMIN'), delete material by id, revalidatePath
```

- [ ] **Step 2: Implement server page**

Fetch all materials JOINed with categories, ordered by code. Pass to `MaterialsClient`.

- [ ] **Step 3: Implement client component**

Table: Code, Name (Ar/En), Unit, Category, Actions (Edit/Delete). Inline edit modal. Bilingual labels.

- [ ] **Step 4: Commit**

```
git add src/app/admin/materials/
git commit -m "feat: add materials admin CRUD page"
```

---

### Task 3: Inventory overview page

- [ ] **Step 1: Implement server actions**

```ts
recordReceipt(prev, formData): requireRole('DATA_ENTRY'), insert stock_transaction RECEIPT
recordIssue(prev, formData): requireRole('DATA_ENTRY'), insert stock_transaction ISSUE (negative)
recordAdjustment(prev, formData): requireRole('DATA_ENTRY'), insert stock_transaction ADJUSTMENT
```

- [ ] **Step 2: Implement server page**

Query materials with computed stock level:
```sql
SELECT m.*, mc.name_ar AS category_name_ar, COALESCE(SUM(st.quantity), 0) AS stock
FROM material m
JOIN material_category mc ON mc.id = m.category_id
LEFT JOIN stock_transaction st ON st.material_id = m.id
GROUP BY m.id
ORDER BY m.code
```

Fetch recent 50 transactions. Pass to `InventoryClient`.

- [ ] **Step 3: Implement client component**

Top section: material stock table (Code, Name, Unit, Category, Stock qty, Actions → Receipt/Issue/Adjust)
Bottom section: transaction log (Date, Material, Type badge, Qty, Reference, Note)
Modal forms for each transaction type with material select, qty, reference, note fields.

- [ ] **Step 4: Commit**

```
git add src/app/admin/inventory/
git commit -m "feat: add inventory overview page with stock ledger"
```

---

### Task 4: Nav links + seed + final integration

- [ ] **Step 1: Update admin layout**

Add nav links for Materials / المواد and Inventory / المخزون.

- [ ] **Step 2: Update seed script**

Add demo categories (Wood, Metal, Fabric, Hardware, Packaging) and materials (particle board MDF 18mm, steel legs, fabric, screws, carton boxes, etc.). Add sample transactions.

- [ ] **Step 3: Verify tsc**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run
```

- [ ] **Step 5: Commit**

```
git add src/app/admin/layout.tsx scripts/seed.ts
git commit -m "feat: add inventory nav links and demo seed data"
```
