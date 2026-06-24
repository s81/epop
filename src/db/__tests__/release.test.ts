import { beforeAll, afterEach, describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/db/schema';
import { releaseWorkOrder } from '@/db/operations';
import fs from 'fs';
import path from 'path';

// Use file::memory:?cache=shared so that multiple connections within the same process
// share a single in-memory database. The plain ':memory:' URL allocates a NEW database
// on every new SQLite connection; because the libSQL Sqlite3Client creates a fresh
// connection after each transaction() call, ':memory:' loses all schema/data after the
// first transaction. The shared-cache URI avoids this while staying fully in-memory.
const testClient = createClient({ url: 'file::memory:?cache=shared' });
const testDb = drizzle(testClient, { schema });

beforeAll(async () => {
  await testClient.execute('PRAGMA foreign_keys = ON');
  const migrationPath = path.resolve(process.cwd(), 'src/db/migrations/0000_misty_khan.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  await testClient.executeMultiple(migrationSql);
});

afterEach(async () => {
  // Clear data between tests but preserve schema.
  // FK-safe delete order: child tables first.
  await testDb.delete(schema.workOrderOperation);
  await testDb.delete(schema.workOrderLine);
  await testDb.delete(schema.workOrder);
  await testDb.delete(schema.routingStep);
  await testDb.delete(schema.workCenter);
  await testDb.delete(schema.model);
  await testDb.delete(schema.department);
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
    const [wo] = await testDb
      .insert(schema.workOrder)
      .values({ orderNumber: 'PO-2026-002', status: 'RELEASED' })
      .returning({ id: schema.workOrder.id });

    await expect(releaseWorkOrder(wo.id, testDb)).rejects.toThrow('not in DRAFT');
  });

  it('throws naming the model when it has no routing steps', async () => {
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
    const [wo] = await testDb
      .insert(schema.workOrder)
      .values({ orderNumber: 'PO-2026-004', status: 'DRAFT' })
      .returning({ id: schema.workOrder.id });

    await expect(releaseWorkOrder(wo.id, testDb)).rejects.toThrow('no lines');
  });
});
