import { db } from './db';
import { operationEvent, workOrderOperation, workCenter, workOrderLine, workOrder, model } from './schema';
import { eq, and, gte, lte, asc } from 'drizzle-orm';

export type LaborRecord = {
  operatorId: string;
  date: string;
  workCenterCode: string;
  workCenterNameAr: string;
  orderNumber: string;
  modelCode: string;
  operationId: number;
  minutes: number;
  events: number;
};

const SESSION_START = new Set(['START', 'RESUME']);
const SESSION_END = new Set(['FINISH', 'PAUSE', 'REJECT', 'RESTART']);

function msToMinutes(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / 60000;
}

function addSession(
  agg: Map<string, LaborRecord>,
  operatorId: string,
  startTime: string,
  endTime: string,
  info: { wcCode: string; wcNameAr: string; orderNumber: string; modelCode: string; operationId: number },
) {
  const date = startTime.slice(0, 10);
  const key = `${operatorId}|${date}|${info.operationId}|${info.wcCode}|${info.orderNumber}`;
  const minutes = msToMinutes(startTime, endTime);

  const existing = agg.get(key);
  if (existing) {
    existing.minutes += minutes;
    existing.events += 1;
  } else {
    agg.set(key, {
      operatorId,
      date,
      workCenterCode: info.wcCode,
      workCenterNameAr: info.wcNameAr,
      orderNumber: info.orderNumber,
      modelCode: info.modelCode,
      operationId: info.operationId,
      minutes: Math.round(minutes),
      events: 1,
    });
  }
}

type AnyDb = typeof db;

export async function getLaborHours(from: string, to: string, dbInstance: AnyDb = db): Promise<LaborRecord[]> {
  const rows = await dbInstance
    .select({
      operationId: operationEvent.operationId,
      eventType: operationEvent.eventType,
      operatorId: operationEvent.operatorId,
      occurredAt: operationEvent.occurredAt,
      wcCode: workCenter.code,
      wcNameAr: workCenter.nameAr,
      orderNumber: workOrder.orderNumber,
      modelCode: model.code,
    })
    .from(operationEvent)
    .innerJoin(workOrderOperation, eq(operationEvent.operationId, workOrderOperation.id))
    .innerJoin(workCenter, eq(workOrderOperation.workCenterId, workCenter.id))
    .innerJoin(workOrderLine, eq(workOrderOperation.workOrderLineId, workOrderLine.id))
    .innerJoin(workOrder, eq(workOrderLine.workOrderId, workOrder.id))
    .innerJoin(model, eq(workOrderLine.modelId, model.id))
    .where(and(
      gte(operationEvent.occurredAt, `${from}T00:00:00.000Z`),
      lte(operationEvent.occurredAt, `${to}T23:59:59.999Z`),
    ))
    .orderBy(asc(operationEvent.operationId), asc(operationEvent.occurredAt));

  const groups = new Map<number, typeof rows>();
  for (const row of rows) {
    if (!groups.has(row.operationId)) groups.set(row.operationId, []);
    groups.get(row.operationId)!.push(row);
  }

  const agg = new Map<string, LaborRecord>();

  for (const [, evts] of groups) {
    let sessionStart: string | null = null;
    let sessionOp: string | null = null;

    for (const ev of evts) {
      if (SESSION_START.has(ev.eventType) && ev.operatorId) {
        sessionStart = ev.occurredAt;
        sessionOp = ev.operatorId;
      } else if (SESSION_END.has(ev.eventType) && sessionStart && sessionOp) {
        addSession(agg, sessionOp, sessionStart, ev.occurredAt, ev);
        sessionStart = null;
        sessionOp = null;
      }
    }
  }

  const records = Array.from(agg.values());
  records.sort((a, b) => b.date.localeCompare(a.date) || a.operatorId.localeCompare(b.operatorId));
  return records;
}
