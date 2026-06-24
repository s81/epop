import { and, asc, eq } from 'drizzle-orm';
import { db } from './db';
import {
  model,
  operationEvent,
  operationTransition,
  routingStep,
  workOrder,
  workOrderLine,
  workOrderOperation,
  type OperationEventType,
  type OperationStatus,
} from './schema';

export class IllegalTransition extends Error {
  constructor(
    public readonly fromStatus: OperationStatus,
    public readonly event: OperationEventType,
  ) {
    super(`No transition from '${fromStatus}' on event '${event}'`);
    this.name = 'IllegalTransition';
  }
}

/**
 * The single mutation path for all shop-floor operation state changes.
 *
 * In one transaction:
 *  1. Reads current status (serialises concurrent taps on the same operation)
 *  2. Looks up the valid transition in operation_transition
 *  3. Appends to operation_event (audit log / live feed)
 *  4. Updates work_order_operation.status + the matching timestamp field
 *
 * Throws IllegalTransition (→ HTTP 409) when no row matches in operation_transition.
 */
export async function applyEvent(
  operationId: number,
  event: OperationEventType,
  opts?: { operatorId?: string; note?: string },
  dbInstance: typeof db = db,
): Promise<{ toStatus: OperationStatus; eventId: number }> {
  return dbInstance.transaction(async (tx) => {
    const [op] = await tx
      .select({ status: workOrderOperation.status })
      .from(workOrderOperation)
      .where(eq(workOrderOperation.id, operationId));

    if (!op) throw new Error(`Operation ${operationId} not found`);

    const fromStatus = op.status;

    const [transition] = await tx
      .select({ toStatus: operationTransition.toStatus })
      .from(operationTransition)
      .where(
        and(
          eq(operationTransition.fromStatus, fromStatus),
          eq(operationTransition.eventType, event),
        ),
      );

    if (!transition) throw new IllegalTransition(fromStatus, event);

    const toStatus = transition.toStatus;
    const now = new Date().toISOString();

    const [{ eventId }] = await tx
      .insert(operationEvent)
      .values({
        operationId,
        eventType: event,
        operatorId: opts?.operatorId,
        note: opts?.note,
        occurredAt: now,
      })
      .returning({ eventId: operationEvent.id });

    const timestamp = timestampForStatus(toStatus, now);
    await tx
      .update(workOrderOperation)
      .set({ status: toStatus, ...timestamp })
      .where(eq(workOrderOperation.id, operationId));

    return { toStatus, eventId };
  });
}

function timestampForStatus(
  status: OperationStatus,
  now: string,
): Partial<typeof workOrderOperation.$inferInsert> {
  switch (status) {
    case 'IN_PROGRESS': return { startedAt: now };
    case 'PAUSED':      return { pausedAt: now };
    case 'PENDING_QC':  return { finishedAt: now };
    case 'COMPLETED':   return { completedAt: now };
    case 'REJECTED':    return { rejectedAt: now };
    default:            return {};
  }
}

/**
 * Releases a DRAFT work order: validates all lines have routing steps,
 * then in one transaction inserts work_order_operation rows (one per line × step)
 * and flips the work order status to RELEASED.
 *
 * The entire flow runs inside a single transaction. The final UPDATE uses a
 * conditional WHERE clause (status = 'DRAFT') so that a concurrent caller that
 * already committed RELEASED will cause the UPDATE to match 0 rows — detected
 * and rejected — eliminating the TOCTOU race that would otherwise produce
 * duplicate work_order_operation rows.
 *
 * Throws if: order not found, not DRAFT, has no lines, or any model lacks routing.
 * The optional dbInstance parameter exists for unit-test injection.
 */
export async function releaseWorkOrder(
  workOrderId: number,
  dbInstance: typeof db = db,
): Promise<void> {
  await dbInstance.transaction(async (tx) => {
    const [order] = await tx
      .select({ id: workOrder.id, status: workOrder.status })
      .from(workOrder)
      .where(eq(workOrder.id, workOrderId));

    if (!order) throw new Error(`Work order ${workOrderId} not found`);
    if (order.status !== 'DRAFT') throw new Error('Work order is not in DRAFT status');

    const lines = await tx
      .select({ id: workOrderLine.id, modelId: workOrderLine.modelId })
      .from(workOrderLine)
      .where(eq(workOrderLine.workOrderId, workOrderId));

    if (lines.length === 0) throw new Error('Cannot release a work order with no lines');

    // Pre-validate all models have routing — fail before writing anything
    const lineSteps: { lineId: number; steps: { id: number; workCenterId: number; sequence: number }[] }[] = [];

    for (const line of lines) {
      const [mdl] = await tx
        .select({ code: model.code })
        .from(model)
        .where(eq(model.id, line.modelId));

      const steps = await tx
        .select({
          id: routingStep.id,
          workCenterId: routingStep.workCenterId,
          sequence: routingStep.sequence,
        })
        .from(routingStep)
        .where(eq(routingStep.modelId, line.modelId))
        .orderBy(asc(routingStep.sequence));

      if (steps.length === 0) {
        throw new Error(
          `Model "${mdl?.code ?? String(line.modelId)}" has no routing steps — define routing before releasing`,
        );
      }

      lineSteps.push({ lineId: line.id, steps });
    }

    const now = new Date().toISOString();

    for (const { lineId, steps } of lineSteps) {
      for (const step of steps) {
        await tx.insert(workOrderOperation).values({
          workOrderLineId: lineId,
          workCenterId: step.workCenterId,
          routingStepId: step.id,
          sequence: step.sequence,
        });
      }
    }

    const result = await tx
      .update(workOrder)
      .set({ status: 'RELEASED', releasedAt: now })
      .where(and(eq(workOrder.id, workOrderId), eq(workOrder.status, 'DRAFT')));

    // If 0 rows were updated, a concurrent caller already released this order
    if (result.rowsAffected === 0) {
      throw new Error('Work order is not in DRAFT status');
    }
  });
}
