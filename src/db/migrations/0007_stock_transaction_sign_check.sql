-- Sign convention from the inventory design spec: RECEIPT > 0, ISSUE < 0, ADJUSTMENT any.
-- Triggers instead of a CHECK: SQLite has no ADD CONSTRAINT, and scripts/migrate.ts
-- replays every file on each boot, so a table rebuild is neither atomic nor idempotent.
CREATE TRIGGER IF NOT EXISTS trg_stock_tx_sign_ins
BEFORE INSERT ON stock_transaction
WHEN (NEW.type = 'RECEIPT' AND NEW.quantity <= 0) OR (NEW.type = 'ISSUE' AND NEW.quantity >= 0)
BEGIN
  SELECT RAISE(ABORT, 'CHECK constraint failed: stock_transaction sign (RECEIPT > 0, ISSUE < 0)');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_stock_tx_sign_upd
BEFORE UPDATE OF type, quantity ON stock_transaction
WHEN (NEW.type = 'RECEIPT' AND NEW.quantity <= 0) OR (NEW.type = 'ISSUE' AND NEW.quantity >= 0)
BEGIN
  SELECT RAISE(ABORT, 'CHECK constraint failed: stock_transaction sign (RECEIPT > 0, ISSUE < 0)');
END;
