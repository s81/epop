CREATE TABLE IF NOT EXISTS production_target (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_center_id INTEGER NOT NULL REFERENCES work_center(id),
  date TEXT NOT NULL,
  target_quantity INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_production_target_wc_date ON production_target(work_center_id, date);
