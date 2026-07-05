import { Suspense } from 'react';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { operationEvent, qualityDefect, workOrderOperation, workOrderLine, workOrder, model, workCenter } from '@/db/schema';
import type { QualityDefectCategory } from '@/db/schema';
import { QualityFilters } from './filters';
import { QualityExportButton } from './quality-export';
import { Pagination } from '@/components/admin/Pagination';

const PAGE_SIZE = 50;

const CATEGORY_LABEL: Record<QualityDefectCategory, string> = {
  DIMENSIONAL: 'أبعاد / Dimensional',
  SURFACE:     'سطح / Surface + Paint',
  ASSEMBLY:    'تجميع / Assembly',
  OTHER:       'أخرى / Other',
};

const CATEGORY_COLOR: Record<QualityDefectCategory, string> = {
  DIMENSIONAL: 'bg-red-900 text-red-300',
  SURFACE:     'bg-orange-900 text-orange-300',
  ASSEMBLY:    'bg-yellow-900 text-yellow-300',
  OTHER:       'bg-gray-700 text-gray-300',
};

export default async function QualityPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; wc?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const where = and(
    params.category ? eq(qualityDefect.category, params.category as QualityDefectCategory) : undefined,
    params.wc ? eq(workCenter.code, params.wc) : undefined,
  );

  const baseQuery = db
    .select({
      id: qualityDefect.id,
      operationId: workOrderOperation.id,
      eventType: operationEvent.eventType,
      category: qualityDefect.category,
      reportedBy: qualityDefect.reportedBy,
      createdAt: qualityDefect.createdAt,
      orderNumber: workOrder.orderNumber,
      modelNameAr: model.nameAr,
      modelCode: model.code,
      workCenterNameAr: workCenter.nameAr,
      workCenterCode: workCenter.code,
    })
    .from(qualityDefect)
    .innerJoin(operationEvent, eq(qualityDefect.operationEventId, operationEvent.id))
    .innerJoin(workOrderOperation, eq(qualityDefect.operationId, workOrderOperation.id))
    .innerJoin(workOrderLine, eq(workOrderOperation.workOrderLineId, workOrderLine.id))
    .innerJoin(workOrder, eq(workOrderLine.workOrderId, workOrder.id))
    .innerJoin(model, eq(workOrderLine.modelId, model.id))
    .innerJoin(workCenter, eq(workOrderOperation.workCenterId, workCenter.id));

  const [defects, countResult] = await Promise.all([
    baseQuery.where(where).orderBy(desc(qualityDefect.createdAt)).limit(PAGE_SIZE).offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(qualityDefect)
      .innerJoin(operationEvent, eq(qualityDefect.operationEventId, operationEvent.id))
      .innerJoin(workOrderOperation, eq(qualityDefect.operationId, workOrderOperation.id))
      .innerJoin(workOrderLine, eq(workOrderOperation.workOrderLineId, workOrderLine.id))
      .innerJoin(workOrder, eq(workOrderLine.workOrderId, workOrder.id))
      .innerJoin(model, eq(workOrderLine.modelId, model.id))
      .innerJoin(workCenter, eq(workOrderOperation.workCenterId, workCenter.id))
      .where(where),
  ]);

  const totalCount = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const workCenters = await db
    .select({ code: workCenter.code, nameAr: workCenter.nameAr })
    .from(workCenter)
    .orderBy(asc(workCenter.code));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Quality Defects / عيوب الجودة</h1>
        <QualityExportButton defects={defects} />
      </div>

      <Suspense fallback={<div className="h-10" />}>
        <QualityFilters workCenters={workCenters} />
      </Suspense>

      {defects.length === 0 ? (
        <p className="text-gray-500 mt-4">No defects recorded.</p>
      ) : (
        <>
          <table className="w-full text-sm mt-4">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left">
                <th className="pb-2 pr-4 w-10">ID</th>
                <th className="pb-2 pr-4">Op ID</th>
                <th className="pb-2 pr-4">Event</th>
                <th className="pb-2 pr-4">Order</th>
                <th className="pb-2 pr-4">Model</th>
                <th className="pb-2 pr-4">Work Center</th>
                <th className="pb-2 pr-4">Defect Type</th>
                <th className="pb-2 pr-4">Reporter</th>
                <th className="pb-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {defects.map((row) => (
                <tr key={row.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                  <td className="py-3 pr-4 text-gray-500 font-mono text-xs">{row.id}</td>
                  <td className="py-3 pr-4 text-gray-500 font-mono text-xs">{row.operationId}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      row.eventType === 'REJECT' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {row.eventType}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-sm">{row.orderNumber}</td>
                  <td className="py-3 pr-4">
                    <div className="font-medium">{row.modelNameAr}</div>
                    <div className="text-gray-500 text-xs">{row.modelCode}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <div>{row.workCenterNameAr}</div>
                    <div className="text-gray-500 text-xs">{row.workCenterCode}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLOR[row.category]}`}>
                      {CATEGORY_LABEL[row.category]}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-400">{row.reportedBy}</td>
                  <td className="py-3 text-gray-400 font-mono text-xs whitespace-nowrap">
                    {row.createdAt.slice(0, 16).replace('T', ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            basePath="/admin/quality"
            params={{
              ...(params.category ? { category: params.category } : {}),
              ...(params.wc ? { wc: params.wc } : {}),
            }}
          />
        </>
      )}
    </div>
  );
}
