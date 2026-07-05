import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/db';
import {
  model,
  operationEvent,
  workCenter,
  workOrder,
  workOrderLine,
  workOrderOperation,
  type OperationStatus,
} from '@/db/schema';
import { TabletClient } from './client';
import { applyEventAction, reportMaintenanceAction, rejectWithDefectAction } from './actions';

const OPEN_STATUSES: OperationStatus[] = ['QUEUED', 'IN_PROGRESS', 'PAUSED', 'PENDING_QC', 'REJECTED'];

export default async function TabletPage({
  params,
}: {
  params: Promise<{ workCenterId: string }>;
}) {
  const { workCenterId: wcIdStr } = await params;
  const wcId = Number(wcIdStr);

  const [wc] = await db
    .select({
      id: workCenter.id,
      code: workCenter.code,
      nameAr: workCenter.nameAr,
      nameEn: workCenter.nameEn,
    })
    .from(workCenter)
    .where(eq(workCenter.id, wcId));

  if (!wc) notFound();

  const [queue, events] = await Promise.all([
    db
      .select({
        id: workOrderOperation.id,
        sequence: workOrderOperation.sequence,
        status: workOrderOperation.status,
        modelNameAr: model.nameAr,
        modelNameEn: model.nameEn,
        modelCode: model.code,
        orderNumber: workOrder.orderNumber,
        quantity: workOrderLine.quantity,
        startedAt: workOrderOperation.startedAt,
      })
      .from(workOrderOperation)
      .innerJoin(workOrderLine, eq(workOrderLine.id, workOrderOperation.workOrderLineId))
      .innerJoin(workOrder, eq(workOrder.id, workOrderLine.workOrderId))
      .innerJoin(model, eq(model.id, workOrderLine.modelId))
      .where(
        and(
          eq(workOrderOperation.workCenterId, wcId),
          inArray(workOrderOperation.status, OPEN_STATUSES),
        ),
      )
      .orderBy(asc(workOrderOperation.sequence)),

    db
      .select({
        id: operationEvent.id,
        eventType: operationEvent.eventType,
        operatorId: operationEvent.operatorId,
        occurredAt: operationEvent.occurredAt,
        modelNameAr: model.nameAr,
        modelCode: model.code,
      })
      .from(operationEvent)
      .innerJoin(workOrderOperation, eq(workOrderOperation.id, operationEvent.operationId))
      .innerJoin(workOrderLine, eq(workOrderLine.id, workOrderOperation.workOrderLineId))
      .innerJoin(model, eq(model.id, workOrderLine.modelId))
      .where(eq(workOrderOperation.workCenterId, wcId))
      .orderBy(desc(operationEvent.occurredAt))
      .limit(15),
  ]);

  return (
    <TabletClient
      workCenter={wc}
      queue={queue}
      events={events}
      onAction={applyEventAction}
      onMaintenance={reportMaintenanceAction}
      onRejectWithDefect={rejectWithDefectAction}
    />
  );
}
