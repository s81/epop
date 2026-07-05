CREATE TABLE IF NOT EXISTS material_category (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS material (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  category_id INTEGER NOT NULL REFERENCES material_category(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_stock_tx_material ON stock_transaction(material_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_stock_tx_work_order ON stock_transaction(work_order_id);
