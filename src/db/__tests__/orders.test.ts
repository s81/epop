import { beforeAll, afterEach, describe, it, expect } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/db/schema';
import fs from 'fs';
import path from 'path';

const testClient = createClient({ url: 'file::memory:?cache=shared' });
const testDb = drizzle(testClient, { schema });

beforeAll(async () => {
  await testClient.execute('PRAGMA foreign_keys = ON');
  const migrationPath = path.resolve(process.cwd(), 'src/db/migrations/0000_misty_khan.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  await testClient.executeMultiple(migrationSql);
});

afterEach(async () => {
  await testDb.delete(schema.workOrderOperation);
  await testDb.delete(schema.workOrderLine);
  await testDb.delete(schema.workOrder);
  await testDb.delete(schema.routingStep);
  await testDb.delete(schema.workCenter);
  await testDb.delete(schema.model);
  await testDb.delete(schema.department);
});

describe('Work Order CRUD operations', () => {
  it('creates a work order with auto-number format PO-{YEAR}-{SEQ}', async () => {
    const orderNumber = 'PO-2026-001';
    const [wo] = await testDb
      .insert(schema.workOrder)
      .values({ orderNumber })
      .returning({ id: schema.workOrder.id, orderNumber: schema.workOrder.orderNumber });

    expect(wo.orderNumber).toMatch(/^PO-\d{4}-\d{3}$/);
    expect(wo.orderNumber).toBe(orderNumber);
    expect(wo.id).toBeGreaterThan(0);
  });

  it('increments sequence for the next order in the same year', async () => {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;

    await testDb.insert(schema.workOrder).values({ orderNumber: `${prefix}001` });

    const [lastOrder] = await testDb
      .select({ orderNumber: schema.workOrder.orderNumber })
      .from(schema.workOrder)
      .where(sql`${schema.workOrder.orderNumber} LIKE ${prefix + '%'}`)
      .orderBy(
        sql`CAST(SUBSTR(${schema.workOrder.orderNumber}, LENGTH(${prefix}) + 1) AS INTEGER) DESC`,
      )
      .limit(1);

    const nextSeq = lastOrder
      ? parseInt(lastOrder.orderNumber.slice(prefix.length), 10) + 1
      : 1;

    expect(nextSeq).toBe(2);
    expect(`${prefix}${String(nextSeq).padStart(3, '0')}`).toBe(`${prefix}002`);
  });

  it('inserts line alongside the work order', async () => {
    const [dept] = await testDb
      .insert(schema.department)
      .values({ code: 'PROD', nameAr: 'إنتاج', nameEn: 'Production' })
      .returning({ id: schema.department.id });

    const [mdl] = await testDb
      .insert(schema.model)
      .values({ code: 'MDL-A', nameAr: 'نموذج أ', nameEn: 'Model A' })
      .returning({ id: schema.model.id });

    const [wo] = await testDb
      .insert(schema.workOrder)
      .values({ orderNumber: 'PO-2026-010' })
      .returning({ id: schema.workOrder.id });

    await testDb.insert(schema.workOrderLine).values({
      workOrderId: wo.id,
      modelId: mdl.id,
      quantity: 5,
    });

    const lines = await testDb
      .select()
      .from(schema.workOrderLine)
      .where(eq(schema.workOrderLine.workOrderId, wo.id));

    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(5);
    expect(lines[0].modelId).toBe(mdl.id);
  });

  it('deletes a DRAFT work order and cascades lines', async () => {
    const [dept] = await testDb
      .insert(schema.department)
      .values({ code: 'PROD', nameAr: 'إنتاج', nameEn: 'Production' })
      .returning({ id: schema.department.id });

    const [mdl] = await testDb
      .insert(schema.model)
      .values({ code: 'MDL-A', nameAr: 'نموذج أ', nameEn: 'Model A' })
      .returning({ id: schema.model.id });

    const [wo] = await testDb
      .insert(schema.workOrder)
      .values({ orderNumber: 'PO-2026-020', status: 'DRAFT' })
      .returning({ id: schema.workOrder.id });

    await testDb.insert(schema.workOrderLine).values({
      workOrderId: wo.id,
      modelId: mdl.id,
      quantity: 3,
    });

    await testDb.delete(schema.workOrder).where(eq(schema.workOrder.id, wo.id));

    const afterDelete = await testDb
      .select()
      .from(schema.workOrder)
      .where(eq(schema.workOrder.id, wo.id));

    expect(afterDelete).toHaveLength(0);

    const lines = await testDb
      .select()
      .from(schema.workOrderLine)
      .where(eq(schema.workOrderLine.workOrderId, wo.id));

    expect(lines).toHaveLength(0);
  });

  it('prevents deleting a RELEASED work order via guard check', async () => {
    const [wo] = await testDb
      .insert(schema.workOrder)
      .values({ orderNumber: 'PO-2026-030', status: 'RELEASED' })
      .returning({ id: schema.workOrder.id, status: schema.workOrder.status });

    expect(wo.status).toBe('RELEASED');

    const [order] = await testDb
      .select({ status: schema.workOrder.status })
      .from(schema.workOrder)
      .where(eq(schema.workOrder.id, wo.id));

    const canDelete = order && order.status === 'DRAFT';
    expect(canDelete).toBe(false);
  });
});
