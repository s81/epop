import { beforeAll, afterEach, describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/db/schema';
import { getLaborHours } from '@/db/labor';
import fs from 'fs';
import path from 'path';

const testClient = createClient({ url: 'file::memory:?cache=shared' });
const testDb = drizzle(testClient, { schema });

beforeAll(async () => {
  await testClient.execute('PRAGMA foreign_keys = ON');
  for (const file of ['0000_misty_khan.sql', '0003_rework.sql']) {
    const sql = fs.readFileSync(path.resolve(process.cwd(), `src/db/migrations/${file}`), 'utf-8');
    await testClient.executeMultiple(sql);
  }
});

afterEach(async () => {
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
    .values({ orderNumber: 'PO-LAB-001', status: 'RELEASED' })
    .returning({ id: schema.workOrder.id });

  const [line] = await testDb
    .insert(schema.workOrderLine)
    .values({ workOrderId: wo.id, modelId: mdl.id, quantity: 1 })
    .returning({ id: schema.workOrderLine.id });

  const [op] = await testDb
    .insert(schema.workOrderOperation)
    .values({ workOrderLineId: line.id, workCenterId: wc.id, routingStepId: step.id, sequence: 10 })
    .returning({ id: schema.workOrderOperation.id });

  return { dept, wc, mdl, step, wo, line, op };
}

describe('getLaborHours', () => {
  it('returns empty array when no events exist', async () => {
    const result = await getLaborHours('2026-01-01', '2026-01-31', testDb);
    expect(result).toHaveLength(0);
  });

  it('computes simple START -> FINISH pair', async () => {
    const { op } = await seedBase();

    await testDb.insert(schema.operationEvent).values([
      { operationId: op.id, eventType: 'START', operatorId: 'op-1', occurredAt: '2026-07-01T08:00:00.000Z' },
      { operationId: op.id, eventType: 'FINISH', operatorId: 'op-1', occurredAt: '2026-07-01T09:30:00.000Z' },
    ]);

    const result = await getLaborHours('2026-07-01', '2026-07-01', testDb);

    expect(result).toHaveLength(1);
    expect(result[0].operatorId).toBe('op-1');
    expect(result[0].date).toBe('2026-07-01');
    expect(result[0].workCenterCode).toBe('CUT');
    expect(result[0].orderNumber).toBe('PO-LAB-001');
    expect(result[0].modelCode).toBe('MDL-A');
    expect(result[0].operationId).toBe(op.id);
    expect(result[0].minutes).toBe(90);
    expect(result[0].events).toBe(1);
  });

  it('handles START -> PAUSE -> RESUME -> FINISH (two sessions, summed)', async () => {
    const { op } = await seedBase();

    await testDb.insert(schema.operationEvent).values([
      { operationId: op.id, eventType: 'START', operatorId: 'op-1', occurredAt: '2026-07-01T08:00:00.000Z' },
      { operationId: op.id, eventType: 'PAUSE', operatorId: 'op-1', occurredAt: '2026-07-01T09:30:00.000Z' },
      { operationId: op.id, eventType: 'RESUME', operatorId: 'op-1', occurredAt: '2026-07-01T10:00:00.000Z' },
      { operationId: op.id, eventType: 'FINISH', operatorId: 'op-1', occurredAt: '2026-07-01T11:15:00.000Z' },
    ]);

    const result = await getLaborHours('2026-07-01', '2026-07-01', testDb);

    expect(result).toHaveLength(1);
    // 90 min + 75 min = 165 min
    expect(result[0].minutes).toBe(165);
    expect(result[0].events).toBe(2);
  });

  it('handles multiple operators on different operations', async () => {
    const { wc, line, step } = await seedBase();

    const [opA] = await testDb
      .insert(schema.workOrderOperation)
      .values({ workOrderLineId: line.id, workCenterId: wc.id, routingStepId: step.id, sequence: 10 })
      .returning({ id: schema.workOrderOperation.id });

    const [opB] = await testDb
      .insert(schema.workOrderOperation)
      .values({ workOrderLineId: line.id, workCenterId: wc.id, routingStepId: step.id, sequence: 20 })
      .returning({ id: schema.workOrderOperation.id });

    await testDb.insert(schema.operationEvent).values([
      { operationId: opA.id, eventType: 'START', operatorId: 'op-1', occurredAt: '2026-07-01T08:00:00.000Z' },
      { operationId: opA.id, eventType: 'FINISH', operatorId: 'op-1', occurredAt: '2026-07-01T09:00:00.000Z' },
      { operationId: opB.id, eventType: 'START', operatorId: 'op-2', occurredAt: '2026-07-01T08:00:00.000Z' },
      { operationId: opB.id, eventType: 'FINISH', operatorId: 'op-2', occurredAt: '2026-07-01T10:30:00.000Z' },
    ]);

    const result = await getLaborHours('2026-07-01', '2026-07-01', testDb);

    expect(result).toHaveLength(2);

    const op1 = result.find(r => r.operatorId === 'op-1');
    const op2 = result.find(r => r.operatorId === 'op-2');

    expect(op1?.minutes).toBe(60);
    expect(op1?.events).toBe(1);
    expect(op2?.minutes).toBe(150);
    expect(op2?.events).toBe(1);
  });

  it('ignores unmatched START (operation still in progress)', async () => {
    const { op } = await seedBase();

    await testDb.insert(schema.operationEvent).values([
      { operationId: op.id, eventType: 'START', operatorId: 'op-1', occurredAt: '2026-07-01T08:00:00.000Z' },
    ]);

    const result = await getLaborHours('2026-07-01', '2026-07-01', testDb);
    expect(result).toHaveLength(0);
  });

  it('respects date range filter', async () => {
    const { op } = await seedBase();

    await testDb.insert(schema.operationEvent).values([
      { operationId: op.id, eventType: 'START', operatorId: 'op-1', occurredAt: '2026-07-01T08:00:00.000Z' },
      { operationId: op.id, eventType: 'FINISH', operatorId: 'op-1', occurredAt: '2026-07-01T09:00:00.000Z' },
      { operationId: op.id, eventType: 'START', operatorId: 'op-1', occurredAt: '2026-07-02T08:00:00.000Z' },
      { operationId: op.id, eventType: 'FINISH', operatorId: 'op-1', occurredAt: '2026-07-02T09:00:00.000Z' },
    ]);

    const result = await getLaborHours('2026-07-01', '2026-07-01', testDb);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-07-01');
  });

  it('handles PAUSE without operator on end event', async () => {
    const { op } = await seedBase();

    await testDb.insert(schema.operationEvent).values([
      { operationId: op.id, eventType: 'START', operatorId: 'op-1', occurredAt: '2026-07-01T08:00:00.000Z' },
      { operationId: op.id, eventType: 'PAUSE', operatorId: 'op-1', occurredAt: '2026-07-01T09:30:00.000Z' },
      { operationId: op.id, eventType: 'RESUME', operatorId: 'op-1', occurredAt: '2026-07-01T10:00:00.000Z' },
      { operationId: op.id, eventType: 'FINISH', operatorId: 'op-1', occurredAt: '2026-07-01T11:00:00.000Z' },
    ]);

    const result = await getLaborHours('2026-07-01', '2026-07-01', testDb);
    expect(result).toHaveLength(1);
    expect(result[0].minutes).toBe(150);
    expect(result[0].events).toBe(2);
  });

  it('ignores ACCEPT events', async () => {
    const { op } = await seedBase();

    await testDb.insert(schema.operationEvent).values([
      { operationId: op.id, eventType: 'START', operatorId: 'op-1', occurredAt: '2026-07-01T08:00:00.000Z' },
      { operationId: op.id, eventType: 'FINISH', operatorId: 'op-1', occurredAt: '2026-07-01T09:00:00.000Z' },
      { operationId: op.id, eventType: 'ACCEPT', operatorId: 'qc-1', occurredAt: '2026-07-01T09:30:00.000Z' },
    ]);

    const result = await getLaborHours('2026-07-01', '2026-07-01', testDb);
    expect(result).toHaveLength(1);
    expect(result[0].minutes).toBe(60);
    expect(result[0].events).toBe(1);
  });

  it('handles REJECT after FINISH (attributed to START operator)', async () => {
    const { op } = await seedBase();

    await testDb.insert(schema.operationEvent).values([
      { operationId: op.id, eventType: 'START', operatorId: 'op-1', occurredAt: '2026-07-01T08:00:00.000Z' },
      { operationId: op.id, eventType: 'FINISH', operatorId: 'op-1', occurredAt: '2026-07-01T09:00:00.000Z' },
      { operationId: op.id, eventType: 'REJECT', operatorId: 'qc-1', occurredAt: '2026-07-01T09:30:00.000Z' },
    ]);

    const result = await getLaborHours('2026-07-01', '2026-07-01', testDb);
    expect(result).toHaveLength(1);
    expect(result[0].minutes).toBe(60);
  });
});
