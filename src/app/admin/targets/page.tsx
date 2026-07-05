import { and, asc, count, eq, inArray, like, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { operationEvent, productionTarget, workCenter, workOrderOperation } from '@/db/schema';
import { TargetsClient } from './client';

const OPERATION_EVENT_TYPES = ['START', 'PAUSE', 'RESUME', 'FINISH', 'ACCEPT', 'REJECT', 'RESTART'] as const;

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default async function TargetsPage(props: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await props.searchParams;
  const monthStr = month ?? currentMonth();
  const [y, m] = monthStr.split('-').map(Number);
  const numDays = daysInMonth(y, m);
  const datePrefix = `${monthStr}-`;

  const [workCenters, targets, actuals] = await Promise.all([
    db.select().from(workCenter).orderBy(asc(workCenter.code)),
    db.select().from(productionTarget)
      .where(like(productionTarget.date, `${monthStr}-%`))
      .orderBy(asc(productionTarget.date)),
    db.select({
      date: sql<string>`date(${operationEvent.occurredAt})`,
      workCenterId: workOrderOperation.workCenterId,
      count: count(),
    }).from(operationEvent)
      .innerJoin(workOrderOperation, eq(operationEvent.operationId, workOrderOperation.id))
      .where(and(
        inArray(operationEvent.eventType, ['FINISH', 'ACCEPT']),
        like(sql`date(${operationEvent.occurredAt})`, `${monthStr}-%`),
      ))
      .groupBy(sql`date(${operationEvent.occurredAt})`, workOrderOperation.workCenterId),
  ]);

  const targetMap = new Map<string, typeof targets[0]>();
  for (const t of targets) {
    targetMap.set(`${t.workCenterId}-${t.date}`, t);
  }

  const actualMap = new Map<string, number>();
  for (const a of actuals) {
    actualMap.set(`${a.workCenterId}-${a.date}`, a.count);
  }

  const days = Array.from({ length: numDays }, (_, i) => {
    const d = i + 1;
    const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
    const date = new Date(dateStr + 'T00:00:00');
    return {
      day: d,
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dateStr,
    };
  });

  return (
    <TargetsClient
      workCenters={workCenters}
      days={days}
      targetMap={Object.fromEntries(targetMap)}
      actualMap={Object.fromEntries(actualMap)}
      month={monthStr}
    />
  );
}
