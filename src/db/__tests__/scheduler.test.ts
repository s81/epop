import { beforeAll, afterEach, describe, it, expect } from 'vitest';
import { eq, isNotNull } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/db/schema';
import { clearSchedule, runScheduler } from '@/db/scheduler';
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
  await testDb.delete(schema.shiftCalendar);
  await testDb.delete(schema.workOrderOperation);
  await testDb.delete(schema.workOrderLine);
  await testDb.delete(schema.workOrder);
  await testDb.delete(schema.routingStep);
  await testDb.delete(schema.workCenter);
  await testDb.delete(schema.model);
  await testDb.delete(schema.department);
});

/** Seed 45 days of shifts starting yesterday to guarantee coverage. */
async function seedShifts() {
  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);
  const vals: (typeof schema.shiftCalendar.$inferInsert)[] = [];
  for (let i = 0; i < 45; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dayOfWeek = d.getDay();
    const dateStr = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
    vals.push({
      date: dateStr,
      startTime: '08:00',
      endTime: '16:00',
      isWorkingDay: dayOfWeek >= 0 && dayOfWeek <= 4,
    });
  }
  await testDb.insert(schema.shiftCalendar).values(vals);
}

async function seedBase(overrides?: { capacity?: number; buffer?: number }) {
  const [dept] = await testDb
    .insert(schema.department)
    .values({ code: 'PROD', nameAr: 'إنتاج', nameEn: 'Production' })
    .returning();

  const [wc] = await testDb
    .insert(schema.workCenter)
    .values({
      code: 'CUT',
      nameAr: 'قطع',
      nameEn: 'Cutting',
      departmentId: dept.id,
      capacityPerShift: overrides?.capacity ?? 1,
      bufferMinutes: overrides?.buffer ?? 10,
    })
    .returning();

  const [mdl] = await testDb
    .insert(schema.model)
    .values({ code: 'MDL-A', nameAr: 'نموذج أ', nameEn: 'Model A' })
    .returning();

  const [step] = await testDb
    .insert(schema.routingStep)
    .values({
      modelId: mdl.id, workCenterId: wc.id, sequence: 10,
      setupTimeMinutes: 5, manTimeMinutes: 30, machineTimeMinutes: 20,
    })
    .returning();

  const [wo] = await testDb
    .insert(schema.workOrder)
    .values({ orderNumber: 'PO-TEST-001', status: 'RELEASED' })
    .returning();

  const [line] = await testDb
    .insert(schema.workOrderLine)
    .values({ workOrderId: wo.id, modelId: mdl.id, quantity: 2 })
    .returning();

  return { dept, wc, mdl, step, wo, line };
}

async function createOp(
  wcId: number, lineId: number, stepId: number, seq: number, status: typeof schema.OPERATION_STATUSES[number] = 'QUEUED',
) {
  const [op] = await testDb
    .insert(schema.workOrderOperation)
    .values({
      workOrderLineId: lineId, workCenterId: wcId, routingStepId: stepId,
      sequence: seq, status,
    })
    .returning();
  return op;
}

describe('clearSchedule', () => {
  it('clears existing scheduled times from QUEUED operations', async () => {
    const { wc, line, step } = await seedBase();
    const op = await createOp(wc.id, line.id, step.id, 10);
    // Give it a scheduled time
    await testDb
      .update(schema.workOrderOperation)
      .set({ scheduledStart: '2026-07-06T08:00:00.000Z', scheduledEnd: '2026-07-06T09:00:00.000Z' })
      .where(eq(schema.workOrderOperation.id, op.id));

    const cleared = await clearSchedule(testDb);
    expect(cleared).toBe(1);

    const [check] = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.id, op.id));
    expect(check.scheduledStart).toBeNull();
    expect(check.scheduledEnd).toBeNull();
  });

  it('does nothing if no QUEUED ops have scheduled times', async () => {
    const { wc, line, step } = await seedBase();
    await createOp(wc.id, line.id, step.id, 10);
    const cleared = await clearSchedule(testDb);
    expect(cleared).toBe(0);
  });
});

describe('runScheduler', () => {
  it('schedules a single QUEUED operation', async () => {
    await seedShifts();
    const { wc, line, step } = await seedBase();
    const op = await createOp(wc.id, line.id, step.id, 10);

    const result = await runScheduler(testDb);
    expect(result.scheduled).toBe(1);
    expect(result.errors).toHaveLength(0);

    const [check] = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.id, op.id));
    expect(check.scheduledStart).not.toBeNull();
    expect(check.scheduledEnd).not.toBeNull();
    // Should be within working hours (08:00-16:00)
    const startH = new Date(check.scheduledStart!).getHours();
    const endH = new Date(check.scheduledEnd!).getHours();
    expect(startH).toBeGreaterThanOrEqual(8);
    expect(startH).toBeLessThan(16);
  });

  it('schedules within working hours (08:00-16:00 Sun-Thu)', async () => {
    await seedShifts();
    const { wc, line, step } = await seedBase();
    await Promise.all([
      createOp(wc.id, line.id, step.id, 10),
      createOp(wc.id, line.id, step.id, 20),
      createOp(wc.id, line.id, step.id, 30),
      createOp(wc.id, line.id, step.id, 40),
    ]);

    const result = await runScheduler(testDb);
    expect(result.scheduled).toBe(4);

    const scheduled = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(isNotNull(schema.workOrderOperation.scheduledStart))
      .orderBy(schema.workOrderOperation.sequence);

    for (const op of scheduled) {
      const start = new Date(op.scheduledStart!);
      const end = new Date(op.scheduledEnd!);
      const day = start.getDay();
      // Sun-Thu only
      expect(day).toBeGreaterThanOrEqual(0);
      expect(day).toBeLessThanOrEqual(4);
      // Within shift
      expect(start.getHours()).toBeGreaterThanOrEqual(8);
      expect(start.getHours()).toBeLessThan(16);
      expect(end.getHours()).toBeLessThanOrEqual(16);
    }
  });

  it('uses capacityPerShift to run operations in parallel', async () => {
    await seedShifts();
    const { wc, line, step } = await seedBase({ capacity: 2, buffer: 0 });
    await Promise.all([
      createOp(wc.id, line.id, step.id, 10),
      createOp(wc.id, line.id, step.id, 20),
      createOp(wc.id, line.id, step.id, 30),
    ]);

    const result = await runScheduler(testDb);
    expect(result.scheduled).toBe(3);

    const scheduled = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(isNotNull(schema.workOrderOperation.scheduledStart))
      .orderBy(schema.workOrderOperation.sequence);

    // ops 1 and 2 should start at the same time (parallel), op 3 starts after the first finishes
    const start0 = new Date(scheduled[0].scheduledStart!).getTime();
    const start1 = new Date(scheduled[1].scheduledStart!).getTime();
    const start2 = new Date(scheduled[2].scheduledStart!).getTime();
    expect(start0).toBe(start1); // parallel start
    expect(start2).toBeGreaterThanOrEqual(start0); // sequential after
  });

  it('respects buffer in duration', async () => {
    await seedShifts();
    const { wc, line, step } = await seedBase({ buffer: 30 }); // 30min buffer
    const op = await createOp(wc.id, line.id, step.id, 10);

    await runScheduler(testDb);
    // Duration = setup(5) + max(man=30, mach=20) + buffer(30) = 65 min
    const [check] = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.id, op.id));

    const start = new Date(check.scheduledStart!);
    const end = new Date(check.scheduledEnd!);
    const actualMinutes = (end.getTime() - start.getTime()) / 60000;
    expect(actualMinutes).toBe(65);
  });

  it('skips non-QUEUED operations', async () => {
    await seedShifts();
    const { wc, line, step } = await seedBase();
    await createOp(wc.id, line.id, step.id, 10, 'IN_PROGRESS');
    await createOp(wc.id, line.id, step.id, 20, 'QUEUED');

    const result = await runScheduler(testDb);
    // Only the QUEUED one should be scheduled
    expect(result.scheduled).toBe(1);
  });

  it('handles empty WC — no errors', async () => {
    await seedShifts();
    await seedBase();
    // Only create a WC and model, no operations
    const result = await runScheduler(testDb);
    expect(result.scheduled).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});
