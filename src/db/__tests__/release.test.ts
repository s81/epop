import { afterEach, describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/db/schema';
import { releaseWorkOrder } from '@/db/operations';
import fs from 'fs';
import path from 'path';

// Initialize DB with file-based SQLite (in-memory :memory: URLs are isolated per connection in libSQL)
const testDbPath = path.resolve(process.cwd(), 'test.db');
const testClient = createClient({ url: `file:${testDbPath}` });
const testDb = drizzle(testClient, { schema });

// Execute migrations synchronously using sync API
async function initializeDatabase() {
  await testClient.execute('PRAGMA foreign_keys = ON');

  const migrationPath = path.resolve(process.cwd(), 'src/db/migrations/0000_misty_khan.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  const statements = migrationSql
    .split('--> statement-breakpoint')
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0);

  for (const stmt of statements) {
    try {
      await testClient.execute(stmt);
    } catch (err: any) {
      // Ignore "already exists" errors and duplicate constraint errors from seed data
      const msg = err.message || '';
      if (!msg.includes('already exists') && !msg.includes('UNIQUE constraint')) {
        throw err;
      }
    }
  }
}

// This promise is created at module load but its result is awaited in each test
const dbReady = initializeDatabase();

afterEach(async () => {
  try {
    // Clear data between tests but preserve schema
    await testDb.delete(schema.operationEvent);
    await testDb.delete(schema.workOrderOperation);
    await testDb.delete(schema.workOrderLine);
    await testDb.delete(schema.workOrder);
    await testDb.delete(schema.routingStep);
    await testDb.delete(schema.color);
    await testDb.delete(schema.colorFamily);
    await testDb.delete(schema.workCenter);
    await testDb.delete(schema.model);
    await testDb.delete(schema.department);
  } catch (err) {
    // Ignore errors
  }
});

async function seedBase() {
  const [dept] = await testDb
    .insert(schema.department)
    .values({ code: 'PROD', nameAr: 'إنتاج', nameEn: 'Production' })
    .returning({ id: schema.department.id });

  const [wc] = await testDb
    .insert(schema.workCenter)
    .values({ code: 'CUT', nameAr: 'قطع', nameEn: 'Cutting', departmentId: dept.id })
    .returning({ id: schema.workCenter.id });

  const [mdl] = await testDb
    .insert(schema.model)
    .values({ code: 'MDL-A', nameAr: 'نموذج أ', nameEn: 'Model A' })
    .returning({ id: schema.model.id });

  const [step] = await testDb
    .insert(schema.routingStep)
    .values({ modelId: mdl.id, workCenterId: wc.id, sequence: 10 })
    .returning({ id: schema.routingStep.id });

  return { dept, wc, mdl, step };
}

describe('releaseWorkOrder', () => {
  it('creates one operation per line×step and flips status to RELEASED', async () => {
    await dbReady;
    const { mdl, wc, step } = await seedBase();

    const [wo] = await testDb
      .insert(schema.workOrder)
      .values({ orderNumber: 'PO-2026-001', status: 'DRAFT' })
      .returning({ id: schema.workOrder.id });

    const [line] = await testDb
      .insert(schema.workOrderLine)
      .values({ workOrderId: wo.id, modelId: mdl.id, quantity: 2 })
      .returning({ id: schema.workOrderLine.id });

    await releaseWorkOrder(wo.id, testDb);

    const ops = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.workOrderLineId, line.id));

    expect(ops).toHaveLength(1);
    expect(ops[0].workCenterId).toBe(wc.id);
    expect(ops[0].routingStepId).toBe(step.id);
    expect(ops[0].sequence).toBe(10);
    expect(ops[0].status).toBe('QUEUED');

    const [updated] = await testDb
      .select({ status: schema.workOrder.status, releasedAt: schema.workOrder.releasedAt })
      .from(schema.workOrder)
      .where(eq(schema.workOrder.id, wo.id));

    expect(updated.status).toBe('RELEASED');
    expect(updated.releasedAt).toBeTruthy();
  });

  it('throws if order is already RELEASED', async () => {
    await dbReady;
    const [wo] = await testDb
      .insert(schema.workOrder)
      .values({ orderNumber: 'PO-2026-002', status: 'RELEASED' })
      .returning({ id: schema.workOrder.id });

    await expect(releaseWorkOrder(wo.id, testDb)).rejects.toThrow('not in DRAFT');
  });

  it('throws naming the model when it has no routing steps', async () => {
    await dbReady;
    const [mdl] = await testDb
      .insert(schema.model)
      .values({ code: 'MDL-B', nameAr: 'نموذج ب', nameEn: 'Model B' })
      .returning({ id: schema.model.id });

    const [wo] = await testDb
      .insert(schema.workOrder)
      .values({ orderNumber: 'PO-2026-003', status: 'DRAFT' })
      .returning({ id: schema.workOrder.id });

    await testDb
      .insert(schema.workOrderLine)
      .values({ workOrderId: wo.id, modelId: mdl.id, quantity: 1 });

    await expect(releaseWorkOrder(wo.id, testDb)).rejects.toThrow('MDL-B');
  });

  it('throws if order has no lines', async () => {
    await dbReady;
    const [wo] = await testDb
      .insert(schema.workOrder)
      .values({ orderNumber: 'PO-2026-004', status: 'DRAFT' })
      .returning({ id: schema.workOrder.id });

    await expect(releaseWorkOrder(wo.id, testDb)).rejects.toThrow('no lines');
  });
});
