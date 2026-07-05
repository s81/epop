# Inventory / Materials — Design Spec

**Date:** 2026-07-05  
**Status:** Draft

## What we're building

Lightweight inventory tracking for Maani's MES: material master data (categories + SKUs) and a stock transaction ledger (receipts, issues to production, adjustments).

---

## Decisions

| Question | Decision | Reason |
|---|---|---|
| Stock level source | Computed from `stock_transaction` ledger (no redundant stock level table) | Single source of truth, no sync issues |
| Unit of measure | Free-text per material (e.g. "m²", "pcs", "sheet") | Simple, covers all furniture materials |
| Receipt reference | Optional free-text (PO number, supplier, etc.) | Flexible for manual entry |
| Issue target | Optional FK to `work_order`; free-text note otherwise | Track consumption by order when applicable |
| Negative stock | Allowed (alert on dashboard, not blocked) | Warehouse can overshoot temporarily |

---

## Schema additions

```ts
export const materialCategory = sqliteTable('material_category', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  createdAt: text('created_at').notNull().default(sql`...`),
});

export const material = sqliteTable('material', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  unit: text('unit').notNull().default('pcs'),
  categoryId: integer('category_id').notNull().references(() => materialCategory.id),
  createdAt: text('created_at').notNull().default(sql`...`),
});

export const STOCK_TX_TYPES = ['RECEIPT', 'ISSUE', 'ADJUSTMENT'] as const;
export type StockTxType = (typeof STOCK_TX_TYPES)[number];

export const stockTransaction = sqliteTable('stock_transaction', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  materialId: integer('material_id').notNull().references(() => material.id),
  type: text('type', { enum: STOCK_TX_TYPES }).notNull(),
  quantity: real('quantity').notNull(),           // positive for RECEIPT/ADJUSTMENT_UP, negative for ISSUE/ADJUSTMENT_DOWN
  reference: text('reference'),                    // PO number, supplier, etc.
  workOrderId: integer('work_order_id').references(() => workOrder.id),
  note: text('note'),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull().default(sql`...`),
});

CREATE INDEX idx_stock_tx_material ON stock_transaction(material_id);
CREATE INDEX idx_stock_tx_work_order ON stock_transaction(work_order_id);
```

---

## Routes & files

```
src/app/admin/materials/
  page.tsx            ← server: list materials with stock levels (computed)
  actions.ts          ← createMaterial, updateMaterial, deleteMaterial
  client.tsx          ← client: table + inline edit

src/app/admin/inventory/
  page.tsx            ← server: stock overview (all materials, qty, value)
  actions.ts          ← recordReceipt, recordIssue, recordAdjustment
  client.tsx          ← client: transaction log + quick entry forms

src/app/admin/inventory/ledger/
  page.tsx            ← server: full transaction log with filters (material, date, type)
```

---

## Stock level computation

```sql
SELECT material_id, SUM(quantity) AS stock
FROM stock_transaction
GROUP BY material_id;
```

Join with `material` for the admin inventory view. Filter by `work_order_id` for order-specific consumption.

---

## Out of scope

- BOM (future feature — material per routing step)
- Supplier management
- Reorder points / automated purchasing
- Barcode scanning
