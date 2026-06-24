import { beforeAll, afterEach, describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/db/schema';
import { applyEvent } from '@/db/operations';
import fs from 'fs';
import path from 'path';

// file::memory:?cache=shared uses a shared in-memory database so multiple
// connections (opened per-transaction by the libSQL client) all see the same
// schema and data.  Distinct from release.test.ts which runs in a separate
// vitest worker process, so there is no cross-suite collision.
const testClient = createClient({ url: 'file::memory:?cache=shared' });
const testDb = drizzle(testClient, { schema });

beforeAll(async () => {
  await testClient.execute('PRAGMA foreign_keys = ON');
  for (const file of ['0000_misty_khan.sql', '0001_maintenance_quality.sql']) {
    const sql = fs.readFileSync(path.resolve(process.cwd(), `src/db/migrations/${file}`), 'utf-8');
    await testClient.executeMultiple(sql);
  }
});

afterEach(async () => {
  await testDb.delete(schema.qualityDefect);
  await testDb.delete(schema.maintenanceRequest);
  await testDb.delete(schema.operationEvent);
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

  const [wo] = await testDb
    .insert(schema.workOrder)
    .values({ orderNumber: 'PO-MQ-001', status: 'RELEASED' })
    .returning({ id: schema.workOrder.id });

  const [line] = await testDb
    .insert(schema.workOrderLine)
    .values({ workOrderId: wo.id, modelId: mdl.id, quantity: 1 })
    .returning({ id: schema.workOrderLine.id });

  const [op] = await testDb
    .insert(schema.workOrderOperation)
    .values({
      workOrderLineId: line.id,
      workCenterId: wc.id,
      routingStepId: step.id,
      sequence: 10,
      status: 'QUEUED',
    })
    .returning({ id: schema.workOrderOperation.id });

  return { dept, wc, mdl, step, wo, line, op };
}

describe('applyEvent', () => {
  it('returns eventId matching the inserted operation_event row', async () => {
    const { op } = await seedBase();

    const result = await applyEvent(op.id, 'START', {}, testDb);

    expect(result.toStatus).toBe('IN_PROGRESS');
    expect(typeof result.eventId).toBe('number');
    expect(result.eventId).toBeGreaterThan(0);

    const [event] = await testDb
      .select()
      .from(schema.operationEvent)
      .where(eq(schema.operationEvent.id, result.eventId));

    expect(event.eventType).toBe('START');
    expect(event.operationId).toBe(op.id);
  });

  it('quality_defect can reference the returned eventId', async () => {
    const { op, wc } = await seedBase();

    // START → IN_PROGRESS
    await applyEvent(op.id, 'START', {}, testDb);
    // FINISH → PENDING_QC
    await applyEvent(op.id, 'FINISH', {}, testDb);
    // REJECT → REJECTED
    const { eventId } = await applyEvent(op.id, 'REJECT', { operatorId: 'op-42' }, testDb);

    const [defect] = await testDb
      .insert(schema.qualityDefect)
      .values({
        operationId: op.id,
        operationEventId: eventId,
        category: 'DIMENSIONAL',
        reportedBy: 'op-42',
      })
      .returning();

    expect(defect.category).toBe('DIMENSIONAL');
    expect(defect.operationEventId).toBe(eventId);
  });
});
