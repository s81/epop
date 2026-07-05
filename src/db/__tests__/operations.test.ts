import { beforeAll, afterEach, describe, it, expect } from 'vitest';
import { eq, and, inArray } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/db/schema';
import { releaseWorkOrder, applyEvent } from '@/db/operations';
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

  const [wcA] = await testDb
    .insert(schema.workCenter)
    .values({ code: 'CUT', nameAr: 'قطع', nameEn: 'Cutting', departmentId: dept.id })
    .returning({ id: schema.workCenter.id });

  const [wcB] = await testDb
    .insert(schema.workCenter)
    .values({ code: 'SEW', nameAr: 'خياطة', nameEn: 'Sewing', departmentId: dept.id })
    .returning({ id: schema.workCenter.id });

  const [mdl] = await testDb
    .insert(schema.model)
    .values({ code: 'MDL-A', nameAr: 'نموذج أ', nameEn: 'Model A' })
    .returning({ id: schema.model.id });

  const [step] = await testDb
    .insert(schema.routingStep)
    .values({ modelId: mdl.id, workCenterId: wcA.id, sequence: 10 })
    .returning({ id: schema.routingStep.id });

  const [wo] = await testDb
    .insert(schema.workOrder)
    .values({ orderNumber: 'PO-OP-001', status: 'RELEASED' })
    .returning({ id: schema.workOrder.id });

  const [line] = await testDb
    .insert(schema.workOrderLine)
    .values({ workOrderId: wo.id, modelId: mdl.id, quantity: 1 })
    .returning({ id: schema.workOrderLine.id });

  return { dept, wcA, wcB, mdl, step, wo, line };
}

describe('operation queries', () => {
  it('selects operations by work center ID', async () => {
    const { wcA, wcB, line, step } = await seedBase();

    await testDb.insert(schema.workOrderOperation).values([
      { workOrderLineId: line.id, workCenterId: wcA.id, routingStepId: step.id, sequence: 10 },
      { workOrderLineId: line.id, workCenterId: wcA.id, routingStepId: step.id, sequence: 20 },
      { workOrderLineId: line.id, workCenterId: wcB.id, routingStepId: step.id, sequence: 30 },
    ]);

    const ops = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.workCenterId, wcA.id));

    expect(ops).toHaveLength(2);
    expect(ops.every(o => o.workCenterId === wcA.id)).toBe(true);
  });

  it('selects operations by status', async () => {
    const { wcA, line, step } = await seedBase();

    await testDb.insert(schema.workOrderOperation).values([
      { workOrderLineId: line.id, workCenterId: wcA.id, routingStepId: step.id, sequence: 10, status: 'QUEUED' },
      { workOrderLineId: line.id, workCenterId: wcA.id, routingStepId: step.id, sequence: 20, status: 'IN_PROGRESS' },
      { workOrderLineId: line.id, workCenterId: wcA.id, routingStepId: step.id, sequence: 30, status: 'QUEUED' },
    ]);

    const ops = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.status, 'QUEUED'));

    expect(ops).toHaveLength(2);
    expect(ops.every(o => o.status === 'QUEUED')).toBe(true);
  });

  it('selects operations by work center and status (tablet queue pattern)', async () => {
    const { wcA, wcB, line, step } = await seedBase();

    await testDb.insert(schema.workOrderOperation).values([
      { workOrderLineId: line.id, workCenterId: wcA.id, routingStepId: step.id, sequence: 10, status: 'QUEUED' },
      { workOrderLineId: line.id, workCenterId: wcA.id, routingStepId: step.id, sequence: 20, status: 'IN_PROGRESS' },
      { workOrderLineId: line.id, workCenterId: wcB.id, routingStepId: step.id, sequence: 30, status: 'QUEUED' },
    ]);

    const ops = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(
        and(
          eq(schema.workOrderOperation.workCenterId, wcA.id),
          eq(schema.workOrderOperation.status, 'QUEUED'),
        ),
      );

    expect(ops).toHaveLength(1);
    expect(ops[0].status).toBe('QUEUED');
  });

  it('orders operations by sequence', async () => {
    const { wcA, line, step } = await seedBase();

    await testDb.insert(schema.workOrderOperation).values([
      { workOrderLineId: line.id, workCenterId: wcA.id, routingStepId: step.id, sequence: 30 },
      { workOrderLineId: line.id, workCenterId: wcA.id, routingStepId: step.id, sequence: 10 },
      { workOrderLineId: line.id, workCenterId: wcA.id, routingStepId: step.id, sequence: 20 },
    ]);

    const ops = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.workCenterId, wcA.id))
      .orderBy(schema.workOrderOperation.sequence);

    expect(ops).toHaveLength(3);
    expect(ops[0].sequence).toBe(10);
    expect(ops[1].sequence).toBe(20);
    expect(ops[2].sequence).toBe(30);
  });

  it('returns empty array for non-matching work center', async () => {
    const { wcA, line, step } = await seedBase();

    await testDb.insert(schema.workOrderOperation).values([
      { workOrderLineId: line.id, workCenterId: wcA.id, routingStepId: step.id, sequence: 10 },
    ]);

    const ops = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.workCenterId, 99999));

    expect(ops).toHaveLength(0);
  });

  it('returns empty array for non-matching status', async () => {
    const { wcA, line, step } = await seedBase();

    await testDb.insert(schema.workOrderOperation).values([
      { workOrderLineId: line.id, workCenterId: wcA.id, routingStepId: step.id, sequence: 10 },
    ]);

    const ops = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.status, 'COMPLETED'));

    expect(ops).toHaveLength(0);
  });

  it('returns all open status operations for a work center (ix_op_open pattern)', async () => {
    const { wcA, wcB, line, step } = await seedBase();

    await testDb.insert(schema.workOrderOperation).values([
      { workOrderLineId: line.id, workCenterId: wcA.id, routingStepId: step.id, sequence: 10, status: 'QUEUED' },
      { workOrderLineId: line.id, workCenterId: wcA.id, routingStepId: step.id, sequence: 20, status: 'IN_PROGRESS' },
      { workOrderLineId: line.id, workCenterId: wcA.id, routingStepId: step.id, sequence: 30, status: 'PAUSED' },
      { workOrderLineId: line.id, workCenterId: wcB.id, routingStepId: step.id, sequence: 40, status: 'QUEUED' },
      { workOrderLineId: line.id, workCenterId: wcA.id, routingStepId: step.id, sequence: 50, status: 'COMPLETED' },
    ]);

    const openStatuses: (typeof schema.OPERATION_STATUSES)[number][] = ['QUEUED', 'IN_PROGRESS', 'PAUSED'];

    const ops = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(
        and(
          eq(schema.workOrderOperation.workCenterId, wcA.id),
          inArray(schema.workOrderOperation.status, openStatuses),
        ),
      );

    expect(ops).toHaveLength(3);
  });

  it('releaseWorkOrder creates operations with correct work center', async () => {
    const { dept, wcA, wcB, line: _line, step: _step } = await seedBase();

    const [mdl2] = await testDb
      .insert(schema.model)
      .values({ code: 'MDL-B', nameAr: 'نموذج ب', nameEn: 'Model B' })
      .returning({ id: schema.model.id });

    await testDb.insert(schema.routingStep).values([
      { modelId: mdl2.id, workCenterId: wcA.id, sequence: 10 },
      { modelId: mdl2.id, workCenterId: wcB.id, sequence: 20 },
    ]);

    const [wo2] = await testDb
      .insert(schema.workOrder)
      .values({ orderNumber: 'PO-OP-002', status: 'DRAFT' })
      .returning({ id: schema.workOrder.id });

    await testDb
      .insert(schema.workOrderLine)
      .values({ workOrderId: wo2.id, modelId: mdl2.id, quantity: 1 });

    await releaseWorkOrder(wo2.id, testDb);

    const ops = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.workCenterId, wcA.id));

    expect(ops).toHaveLength(1);
    expect(ops[0].workCenterId).toBe(wcA.id);
  });

  it('applyEvent returns eventId matching operation_event row', async () => {
    const { wcA, line, step } = await seedBase();

    const [op] = await testDb
      .insert(schema.workOrderOperation)
      .values({ workOrderLineId: line.id, workCenterId: wcA.id, routingStepId: step.id, sequence: 10 })
      .returning({ id: schema.workOrderOperation.id });

    const { eventId } = await applyEvent(op.id, 'START', {}, testDb);

    const [event] = await testDb
      .select()
      .from(schema.operationEvent)
      .where(eq(schema.operationEvent.id, eventId));

    expect(event.operationId).toBe(op.id);
    expect(event.eventType).toBe('START');
  });
});
