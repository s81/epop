CREATE TABLE maintenance_request (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  work_center_id INTEGER NOT NULL REFERENCES work_center(id),
  operation_id   INTEGER REFERENCES work_order_operation(id),
  category       TEXT NOT NULL CHECK (category IN ('MECHANICAL','ELECTRICAL','TOOLING','OTHER')),
  note           TEXT,
  reported_by    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')),
  resolved_at    TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE quality_defect (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id       INTEGER NOT NULL REFERENCES work_order_operation(id),
  operation_event_id INTEGER NOT NULL REFERENCES operation_event(id),
  category           TEXT NOT NULL CHECK (category IN ('DIMENSIONAL','SURFACE','ASSEMBLY','OTHER')),
  reported_by        TEXT NOT NULL,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
