import { asc, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/db/db';
import {
  model,
  shiftCalendar,
  workCenter,
  workOrder,
  workOrderLine,
  workOrderOperation,
} from '@/db/schema';
import { SchedulerClient } from './client';
import { runScheduleAction, clearScheduleAction } from './actions';

export default async function SchedulerPage() {
  const operations = await db
    .select({
      id: workOrderOperation.id,
      orderNumber: workOrder.orderNumber,
      modelCode: model.code,
      modelNameAr: model.nameAr,
      quantity: workOrderLine.quantity,
      sequence: workOrderOperation.sequence,
      workCenterCode: workCenter.code,
      workCenterNameAr: workCenter.nameAr,
      status: workOrderOperation.status,
      scheduledStart: workOrderOperation.scheduledStart,
      scheduledEnd: workOrderOperation.scheduledEnd,
    })
    .from(workOrderOperation)
    .innerJoin(workOrderLine, eq(workOrderLine.id, workOrderOperation.workOrderLineId))
    .innerJoin(workOrder, eq(workOrder.id, workOrderLine.workOrderId))
    .innerJoin(model, eq(model.id, workOrderLine.modelId))
    .innerJoin(workCenter, eq(workCenter.id, workOrderOperation.workCenterId))
    .orderBy(asc(workCenter.code), asc(workOrder.createdAt), asc(workOrderOperation.sequence));

  const shifts = await db
    .select({ isWorkingDay: shiftCalendar.isWorkingDay })
    .from(shiftCalendar);

  const totalDays = shifts.length;
  const workingDays = shifts.filter((s) => s.isWorkingDay).length;

  const shiftSummary = {
    workingDays,
    totalDays,
    startTime: '08:00',
    endTime: '16:00',
  };

  return (
    <SchedulerClient
      operations={operations}
      shiftSummary={shiftSummary}
      onRun={runScheduleAction}
      onClear={clearScheduleAction}
    />
  );
}
