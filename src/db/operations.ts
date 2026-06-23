import { and, eq } from 'drizzle-orm';
import { db } from './db';
import {
  operationEvent,
  operationTransition,
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
): Promise<{ toStatus: OperationStatus }> {
  return db.transaction(async (tx) => {
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

    await tx.insert(operationEvent).values({
      operationId,
      eventType: event,
      operatorId: opts?.operatorId,
      note: opts?.note,
      occurredAt: now,
    });

    const timestamp = timestampForStatus(toStatus, now);
    await tx
      .update(workOrderOperation)
      .set({ status: toStatus, ...timestamp })
      .where(eq(workOrderOperation.id, operationId));

    return { toStatus };
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
