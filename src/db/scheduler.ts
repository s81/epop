import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { db } from './db';
import {
  routingStep,
  shiftCalendar,
  workCenter,
  workOrder,
  workOrderLine,
  workOrderOperation,
} from './schema';
import { ShiftCalendar } from './shifts';

type Slot = { nextAvailable: Date };

/**
 * Clears all existing scheduledStart/scheduledEnd for QUEUED operations.
 */
export async function clearSchedule(dbInstance: typeof db = db): Promise<number> {
  const queuedIds = await dbInstance
    .select({ id: workOrderOperation.id })
    .from(workOrderOperation)
    .where(
      and(
        eq(workOrderOperation.status, 'QUEUED'),
        isNotNull(workOrderOperation.scheduledStart),
      ),
    );

  if (queuedIds.length === 0) return 0;

  const ids = queuedIds.map((r) => r.id);
  await dbInstance
    .update(workOrderOperation)
    .set({ scheduledStart: null, scheduledEnd: null })
    .where(inArray(workOrderOperation.id, ids));

  return ids.length;
}

/**
 * Greedy finite-capacity scheduler with shift-calendar awareness.
 *
 * For each work center:
 *  1. Collect all QUEUED operations (including already-scheduled ones).
 *  2. Maintain `capacityPerShift` parallel time slots.
 *  3. For each operation assign duration = setup + max(man, machine) + buffer.
 *  4. Place on the earliest available slot, respecting shift boundaries.
 */
export async function runScheduler(dbInstance: typeof db = db): Promise<{
  scheduled: number;
  errors: string[];
}> {
  const now = new Date();
  const shiftCalendar = await ShiftCalendar.load(dbInstance);

  const centers = await dbInstance
    .select({
      id: workCenter.id,
      code: workCenter.code,
      capacityPerShift: workCenter.capacityPerShift,
      bufferMinutes: workCenter.bufferMinutes,
    })
    .from(workCenter)
    .orderBy(asc(workCenter.code));

  let scheduled = 0;
  const errors: string[] = [];

  for (const wc of centers) {
    const operations = await dbInstance
      .select({
        id: workOrderOperation.id,
        sequence: workOrderOperation.sequence,
        setupTimeMinutes: routingStep.setupTimeMinutes,
        manTimeMinutes: routingStep.manTimeMinutes,
        machineTimeMinutes: routingStep.machineTimeMinutes,
        createdAt: workOrder.createdAt,
      })
      .from(workOrderOperation)
      .innerJoin(workOrderLine, eq(workOrderLine.id, workOrderOperation.workOrderLineId))
      .innerJoin(workOrder, eq(workOrder.id, workOrderLine.workOrderId))
      .innerJoin(routingStep, eq(routingStep.id, workOrderOperation.routingStepId))
      .where(
        and(
          eq(workOrderOperation.workCenterId, wc.id),
          eq(workOrderOperation.status, 'QUEUED'),
        ),
      )
      .orderBy(asc(workOrder.createdAt), asc(workOrderOperation.sequence));

    if (operations.length === 0) continue;

    const capacity = Math.max(1, Math.floor(wc.capacityPerShift));
    const slots: Slot[] = Array.from({ length: capacity }, () => ({ nextAvailable: new Date(now) }));
    const bufferMs = (wc.bufferMinutes ?? 0) * 60 * 1000;

    for (const op of operations) {
      const durationMinutes =
        (op.setupTimeMinutes ?? 0) +
        Math.max(op.manTimeMinutes ?? 0, op.machineTimeMinutes ?? 0) +
        (wc.bufferMinutes ?? 0);

      let earliest = slots[0];
      for (let i = 1; i < slots.length; i++) {
        if (slots[i].nextAvailable < earliest.nextAvailable) earliest = slots[i];
      }

      const start = shiftCalendar.getNextSlotStart(earliest.nextAvailable);
      const end = shiftCalendar.addDuration(start, durationMinutes);

      try {
        await dbInstance
          .update(workOrderOperation)
          .set({
            scheduledStart: start.toISOString(),
            scheduledEnd: end.toISOString(),
          })
          .where(eq(workOrderOperation.id, op.id));

        earliest.nextAvailable = end;
        scheduled++;
      } catch (e) {
        errors.push(`Operation ${op.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return { scheduled, errors };
}
