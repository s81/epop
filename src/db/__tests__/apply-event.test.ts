import { beforeAll, afterEach, describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/db/schema';
import { applyEvent, IllegalTransition } from '@/db/operations';
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
    .values({ orderNumber: 'PO-AE-001', status: 'RELEASED' })
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
    })
    .returning({ id: schema.workOrderOperation.id });

  return { dept, wc, mdl, step, wo, line, op };
}

describe('applyEvent', () => {
  it('START: QUEUED → IN_PROGRESS, sets startedAt', async () => {
    const { op } = await seedBase();
    const { toStatus } = await applyEvent(op.id, 'START', {}, testDb);
    expect(toStatus).toBe('IN_PROGRESS');

    const [updated] = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.id, op.id));

    expect(updated.status).toBe('IN_PROGRESS');
    expect(updated.startedAt).toBeTruthy();
  });

  it('START fails when already IN_PROGRESS', async () => {
    const { op } = await seedBase();
    await applyEvent(op.id, 'START', {}, testDb);
    await expect(applyEvent(op.id, 'START', {}, testDb)).rejects.toBeInstanceOf(IllegalTransition);
  });

  it('PAUSE: IN_PROGRESS → PAUSED, sets pausedAt', async () => {
    const { op } = await seedBase();
    await applyEvent(op.id, 'START', {}, testDb);
    const { toStatus } = await applyEvent(op.id, 'PAUSE', {}, testDb);
    expect(toStatus).toBe('PAUSED');

    const [updated] = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.id, op.id));

    expect(updated.status).toBe('PAUSED');
    expect(updated.pausedAt).toBeTruthy();
  });

  it('RESUME: PAUSED → IN_PROGRESS', async () => {
    const { op } = await seedBase();
    await applyEvent(op.id, 'START', {}, testDb);
    await applyEvent(op.id, 'PAUSE', {}, testDb);
    const { toStatus } = await applyEvent(op.id, 'RESUME', {}, testDb);
    expect(toStatus).toBe('IN_PROGRESS');

    const [updated] = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.id, op.id));

    expect(updated.status).toBe('IN_PROGRESS');
  });

  it('FINISH: IN_PROGRESS → PENDING_QC, sets finishedAt', async () => {
    const { op } = await seedBase();
    await applyEvent(op.id, 'START', {}, testDb);
    const { toStatus } = await applyEvent(op.id, 'FINISH', {}, testDb);
    expect(toStatus).toBe('PENDING_QC');

    const [updated] = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.id, op.id));

    expect(updated.status).toBe('PENDING_QC');
    expect(updated.finishedAt).toBeTruthy();
  });

  it('FINISH fails when not IN_PROGRESS', async () => {
    const { op } = await seedBase();
    await expect(applyEvent(op.id, 'FINISH', {}, testDb)).rejects.toBeInstanceOf(IllegalTransition);
  });

  it('ACCEPT: PENDING_QC → COMPLETED, sets completedAt', async () => {
    const { op } = await seedBase();
    await applyEvent(op.id, 'START', {}, testDb);
    await applyEvent(op.id, 'FINISH', {}, testDb);
    const { toStatus } = await applyEvent(op.id, 'ACCEPT', {}, testDb);
    expect(toStatus).toBe('COMPLETED');

    const [updated] = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.id, op.id));

    expect(updated.status).toBe('COMPLETED');
    expect(updated.completedAt).toBeTruthy();
  });

  it('REJECT: PENDING_QC → REJECTED, sets rejectedAt', async () => {
    const { op } = await seedBase();
    await applyEvent(op.id, 'START', {}, testDb);
    await applyEvent(op.id, 'FINISH', {}, testDb);
    const { toStatus } = await applyEvent(op.id, 'REJECT', { operatorId: 'op-1' }, testDb);
    expect(toStatus).toBe('REJECTED');

    const [updated] = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.id, op.id));

    expect(updated.status).toBe('REJECTED');
    expect(updated.rejectedAt).toBeTruthy();
  });

  it('REJECT fails when not PENDING_QC', async () => {
    const { op } = await seedBase();
    await expect(applyEvent(op.id, 'REJECT', {}, testDb)).rejects.toBeInstanceOf(IllegalTransition);
  });

  it('RESTART: REJECTED → QUEUED', async () => {
    const { op } = await seedBase();
    await applyEvent(op.id, 'START', {}, testDb);
    await applyEvent(op.id, 'FINISH', {}, testDb);
    await applyEvent(op.id, 'REJECT', { operatorId: 'op-1' }, testDb);
    const { toStatus } = await applyEvent(op.id, 'RESTART', {}, testDb);
    expect(toStatus).toBe('QUEUED');

    const [updated] = await testDb
      .select()
      .from(schema.workOrderOperation)
      .where(eq(schema.workOrderOperation.id, op.id));

    expect(updated.status).toBe('QUEUED');
  });

  it('throws IllegalTransition for invalid move on COMPLETED', async () => {
    const { op } = await seedBase();
    await applyEvent(op.id, 'START', {}, testDb);
    await applyEvent(op.id, 'FINISH', {}, testDb);
    await applyEvent(op.id, 'ACCEPT', {}, testDb);
    await expect(applyEvent(op.id, 'START', {}, testDb)).rejects.toBeInstanceOf(IllegalTransition);
  });

  it('IllegalTransition carries fromStatus and event properties', async () => {
    const { op } = await seedBase();
    await applyEvent(op.id, 'START', {}, testDb);
    try {
      await applyEvent(op.id, 'START', {}, testDb);
    } catch (e) {
      expect(e).toBeInstanceOf(IllegalTransition);
      expect((e as IllegalTransition).fromStatus).toBe('IN_PROGRESS');
      expect((e as IllegalTransition).event).toBe('START');
      return;
    }
    expect.fail('Expected IllegalTransition');
  });

  it('IllegalTransition message includes fromStatus and event', async () => {
    const { op } = await seedBase();
    try {
      await applyEvent(op.id, 'FINISH', {}, testDb);
    } catch (e) {
      expect((e as Error).message).toContain('QUEUED');
      expect((e as Error).message).toContain('FINISH');
      return;
    }
    expect.fail('Expected IllegalTransition');
  });

  it('stores operatorId in operation_event', async () => {
    const { op } = await seedBase();
    const { eventId } = await applyEvent(op.id, 'START', { operatorId: 'op-42' }, testDb);

    const [event] = await testDb
      .select()
      .from(schema.operationEvent)
      .where(eq(schema.operationEvent.id, eventId));

    expect(event.operatorId).toBe('op-42');
  });

  it('stores note in operation_event on REJECT', async () => {
    const { op } = await seedBase();
    await applyEvent(op.id, 'START', {}, testDb);
    await applyEvent(op.id, 'FINISH', {}, testDb);
    const { eventId } = await applyEvent(op.id, 'REJECT', { operatorId: 'op-1', note: 'Surface scratch detected' }, testDb);

    const [event] = await testDb
      .select()
      .from(schema.operationEvent)
      .where(eq(schema.operationEvent.id, eventId));

    expect(event.note).toBe('Surface scratch detected');
  });
});
