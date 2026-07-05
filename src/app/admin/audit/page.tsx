import { Suspense } from 'react';
import Link from 'next/link';
import { and, desc, eq, gte, like, lte, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { operationEvent, workOrderOperation, workCenter, workOrderLine, workOrder, model, type OperationEventType } from '@/db/schema';
import { AuditFilters } from './filters';

const EVENT_BADGE: Record<string, string> = {
  START:  'bg-green-900 text-green-300',
  PAUSE:  'bg-amber-900 text-amber-300',
  RESUME: 'bg-green-900 text-green-300',
  FINISH: 'bg-blue-900 text-blue-300',
  ACCEPT: 'bg-emerald-900 text-emerald-300',
  REJECT: 'bg-red-900 text-red-300',
  RESTART:'bg-purple-900 text-purple-300',
};

const EVENT_LABEL: Record<string, string> = {
  START:  'بدء / Start',
  PAUSE:  'إيقاف / Pause',
  RESUME: 'استئناف / Resume',
  FINISH: 'إنهاء / Finish',
  ACCEPT: 'قبول / Accept',
  REJECT: 'رفض / Reject',
  RESTART:'إعادة / Rework',
};

const PAGE_SIZE = 25;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ eventType?: string; operatorId?: string; from?: string; to?: string; workCenterCode?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const where = and(
    params.eventType ? eq(operationEvent.eventType, params.eventType as OperationEventType) : undefined,
    params.operatorId ? like(operationEvent.operatorId, `%${params.operatorId}%`) : undefined,
    params.from ? gte(operationEvent.occurredAt, params.from) : undefined,
    params.to ? lte(operationEvent.occurredAt, params.to + 'T23:59:59') : undefined,
    params.workCenterCode ? eq(workCenter.code, params.workCenterCode) : undefined,
  );

  const baseQuery = db
    .select({
      id: operationEvent.id,
      eventType: operationEvent.eventType,
      operatorId: operationEvent.operatorId,
      note: operationEvent.note,
      occurredAt: operationEvent.occurredAt,
      operationId: workOrderOperation.id,
      workCenterCode: workCenter.code,
      workCenterNameAr: workCenter.nameAr,
      orderNumber: workOrder.orderNumber,
      modelCode: model.code,
      modelNameAr: model.nameAr,
    })
    .from(operationEvent)
    .innerJoin(workOrderOperation, eq(operationEvent.operationId, workOrderOperation.id))
    .innerJoin(workCenter, eq(workOrderOperation.workCenterId, workCenter.id))
    .innerJoin(workOrderLine, eq(workOrderOperation.workOrderLineId, workOrderLine.id))
    .innerJoin(workOrder, eq(workOrderLine.workOrderId, workOrder.id))
    .innerJoin(model, eq(workOrderLine.modelId, model.id));

  const [events, countResult] = await Promise.all([
    baseQuery.where(where).orderBy(desc(operationEvent.occurredAt)).limit(PAGE_SIZE).offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(operationEvent)
      .innerJoin(workOrderOperation, eq(operationEvent.operationId, workOrderOperation.id))
      .innerJoin(workCenter, eq(workOrderOperation.workCenterId, workCenter.id))
      .innerJoin(workOrderLine, eq(workOrderOperation.workOrderLineId, workOrderLine.id))
      .innerJoin(workOrder, eq(workOrderLine.workOrderId, workOrder.id))
      .innerJoin(model, eq(workOrderLine.modelId, model.id))
      .where(where),
  ]);

  const totalCount = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  function buildPageUrl(p: number) {
    const s = new URLSearchParams();
    if (params.eventType) s.set('eventType', params.eventType);
    if (params.operatorId) s.set('operatorId', params.operatorId);
    if (params.from) s.set('from', params.from);
    if (params.to) s.set('to', params.to);
    if (params.workCenterCode) s.set('workCenterCode', params.workCenterCode);
    if (p > 1) s.set('page', String(p));
    return `/admin/audit${s.toString() ? '?' + s.toString() : ''}`;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Audit Log / سجل الأحداث</h1>

      <Suspense fallback={<div className="h-10" />}>
        <AuditFilters />
      </Suspense>

      {events.length === 0 ? (
        <p className="text-gray-500 mt-4">No events recorded / لا توجد أحداث</p>
      ) : (
        <>
          <table className="w-full text-sm mt-4">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left">
                <th className="pb-2 pr-4">Time / الوقت</th>
                <th className="pb-2 pr-4">Event / الحدث</th>
                <th className="pb-2 pr-4">Work Center / مركز العمل</th>
                <th className="pb-2 pr-4">Order / الأمر</th>
                <th className="pb-2 pr-4">Model / الموديل</th>
                <th className="pb-2 pr-4">Operator / المشغل</th>
                <th className="pb-2">Note / ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {events.map((row) => (
                <tr key={row.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                  <td className="py-3 pr-4 text-gray-400 font-mono text-xs whitespace-nowrap">
                    {row.occurredAt.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${EVENT_BADGE[row.eventType]}`}>
                      {EVENT_LABEL[row.eventType]}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <div>{row.workCenterNameAr}</div>
                    <div className="text-gray-500 text-xs">{row.workCenterCode}</div>
                  </td>
                  <td className="py-3 pr-4 font-mono text-sm">{row.orderNumber}</td>
                  <td className="py-3 pr-4">
                    <div className="font-medium">{row.modelNameAr}</div>
                    <div className="text-gray-500 text-xs">{row.modelCode}</div>
                  </td>
                  <td className="py-3 pr-4 text-gray-400">{row.operatorId || '—'}</td>
                  <td className="py-3 text-gray-400 max-w-xs truncate">{row.note || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-700 text-gray-400">
                <td className="py-3 pr-4 text-xs font-semibold" colSpan={7}>
                  Total / المجموع: {events.length} events on this page
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="flex items-center justify-between mt-6 text-sm text-gray-400">
            <div>
              {totalCount} total events · Page {page} of {Math.max(1, totalPages)} / إجمالي {totalCount} حدث · صفحة {page} من {Math.max(1, totalPages)}
            </div>
            <div className="flex gap-4">
              {page > 1 ? (
                <Link href={buildPageUrl(page - 1)} className="text-blue-400 hover:text-blue-300 transition-colors">
                  Previous / السابق
                </Link>
              ) : (
                <span className="text-gray-600">Previous / السابق</span>
              )}
              {page < totalPages ? (
                <Link href={buildPageUrl(page + 1)} className="text-blue-400 hover:text-blue-300 transition-colors">
                  Next / التالي
                </Link>
              ) : (
                <span className="text-gray-600">Next / التالي</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
