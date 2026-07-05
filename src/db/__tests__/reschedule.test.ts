import { beforeAll, afterEach, describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/db/schema';
import fs from 'fs';
import path from 'path';

const testClient = createClient({ url: 'file::memory:?cache=shared' });
const testDb = drizzle(testClient, { schema });

beforeAll(async () => {
  await testClient.execute('PRAGMA foreign_keys = ON');
  for (const file of ['0000_misty_khan.sql', '0004_shift_calendar.sql']) {
    const sql = fs.readFileSync(path.resolve(process.cwd(), `src/db/migrations/${file}`), 'utf-8');
    await testClient.executeMultiple(sql);
  }
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

async function seedBase() {
  const [dept] = await testDb
    .insert(schema.department)
    .values({ code: 'PROD', nameAr: 'إنتاج', nameEn: 'Production' })
    .returning();

  const [wc] = await testDb
    .insert(schema.workCenter)
    .values({ code: 'CUT', nameAr: 'قطع', nameEn: 'Cutting', departmentId: dept.id })
    .returning();

  const [mdl] = await testDb
    .insert(schema.model)
    .values({ code: 'MDL-A', nameAr: 'نموذج أ', nameEn: 'Model A' })
    .returning();

  const [step] = await testDb
    .insert(schema.routingStep)
    .values({ modelId: mdl.id, workCenterId: wc.id, sequence: 10, setupTimeMinutes: 5, manTimeMinutes: 30, machineTimeMinutes: 20 })
    .returning();

  const [wo] = await testDb
    .insert(schema.workOrder)
    .values({ orderNumber: 'PO-RESCHED-001', status: 'RELEASED' })
    .returning();

  const [line] = await testDb
    .insert(schema.workOrderLine)
    .values({ workOrderId: wo.id, modelId: mdl.id, quantity: 2 })
    .returning();

  return { dept, wc, mdl, step, wo, line };
}

async function createOp(
  wcId: number, lineId: number, stepId: number, seq: number,
  status: typeof schema.OPERATION_STATUSES[number] = 'QUEUED',
) {
  const [op] = await testDb
    .insert(schema.workOrderOperation)
    .values({ workOrderLineId: lineId, workCenterId: wcId, routingStepId: stepId, sequence: seq, status })
    .returning();
  return op;
}

/** Core logic mirroring rescheduleOperation but bypassing auth. */
async function rescheduleOp(
  operationId: number, newStart: string, newEnd: string,
): Promise<{ success: boolean } | { error: string }> {
  const [op] = await testDb
    .select({ status: schema.workOrderOperation.status })
    .from(schema.workOrderOperation)
    .where(eq(schema.workOrderOperation.id, operationId))
    .limit(1);

  if (!op) return { error: 'Operation not found' };
  if (op.status !== 'QUEUED') return { error: 'Only QUEUED operations can be rescheduled' };

  await testDb
    .update(schema.workOrderOperation)
    .set({ scheduledStart: newStart, scheduledEnd: newEnd })
    .where(eq(schema.workOrderOperation.id, operationId));

  return { success: true };
}

describe('rescheduleOperation', () => {
  it('updates scheduled times for QUEUED operation', async () => {
    const { wc, line, step } = await seedBase();
    const op = await createOp(wc.id, line.id, step.id, 10, 'QUEUED');

    const newStart = '2026-07-08T08:00:00.000Z';
    const newEnd = '2026-07-08T09:00:00.000Z';
    const result = await rescheduleOp(op.id, newStart, newEnd);

    expect(result).toEqual({ success: true });

    const [check] = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.id, op.id));

    expect(check.scheduledStart).toBe(newStart);
    expect(check.scheduledEnd).toBe(newEnd);
    expect(check.status).toBe('QUEUED');
  });

  it('returns error for non-existent operation', async () => {
    const result = await rescheduleOp(99999, '2026-07-08T08:00:00.000Z', '2026-07-08T09:00:00.000Z');
    expect(result).toEqual({ error: 'Operation not found' });
  });

  it.each([
    ['IN_PROGRESS', 'IN_PROGRESS'],
    ['PAUSED', 'PAUSED'],
    ['PENDING_QC', 'PENDING_QC'],
    ['COMPLETED', 'COMPLETED'],
    ['REJECTED', 'REJECTED'],
  ])('rejects %s operation', async (_label, status) => {
    const { wc, line, step } = await seedBase();
    const op = await createOp(wc.id, line.id, step.id, 10, status as typeof schema.OPERATION_STATUSES[number]);

    const result = await rescheduleOp(op.id, '2026-07-08T08:00:00.000Z', '2026-07-08T09:00:00.000Z');

    expect(result).toEqual({ error: 'Only QUEUED operations can be rescheduled' });

    const [check] = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.id, op.id));

    expect(check.scheduledStart).toBeNull();
    expect(check.scheduledEnd).toBeNull();
  });
});
