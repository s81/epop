import { Suspense } from 'react';
import { asc, desc, eq, sql, and, like } from 'drizzle-orm';
import { db } from '@/db/db';
import {
  model,
  workCenter,
  workOrder,
  workOrderLine,
  workOrderOperation,
  type OperationStatus,
} from '@/db/schema';
import { OperationsFilters, OperationsActions } from './client';
import { Pagination } from '@/components/admin/Pagination';

const PAGE_SIZE = 50;

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; wc?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const where = and(
    params.status ? eq(workOrderOperation.status, params.status as OperationStatus) : undefined,
    params.wc ? eq(workCenter.code, params.wc) : undefined,
    params.q ? like(workOrder.orderNumber, `%${params.q}%`) : undefined,
  );

  const baseQuery = db
    .select({
      id: workOrderOperation.id,
      sequence: workOrderOperation.sequence,
      status: workOrderOperation.status,
      scheduledStart: workOrderOperation.scheduledStart,
      scheduledEnd: workOrderOperation.scheduledEnd,
      createdAt: workOrderOperation.createdAt,
      orderNumber: workOrder.orderNumber,
      modelCode: model.code,
      modelNameAr: model.nameAr,
      workCenterCode: workCenter.code,
      workCenterNameAr: workCenter.nameAr,
      quantity: workOrderLine.quantity,
    })
    .from(workOrderOperation)
    .innerJoin(workOrderLine, eq(workOrderLine.id, workOrderOperation.workOrderLineId))
    .innerJoin(workOrder, eq(workOrder.id, workOrderLine.workOrderId))
    .innerJoin(model, eq(model.id, workOrderLine.modelId))
    .innerJoin(workCenter, eq(workCenter.id, workOrderOperation.workCenterId));

  const [operations, countResult] = await Promise.all([
    baseQuery.where(where).orderBy(desc(workOrderOperation.createdAt)).limit(PAGE_SIZE).offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(workOrderOperation)
      .innerJoin(workOrderLine, eq(workOrderLine.id, workOrderOperation.workOrderLineId))
      .innerJoin(workOrder, eq(workOrder.id, workOrderLine.workOrderId))
      .innerJoin(model, eq(model.id, workOrderLine.modelId))
      .innerJoin(workCenter, eq(workCenter.id, workOrderOperation.workCenterId))
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
        <h1 className="text-xl font-semibold text-gray-900">Operations / العمليات</h1>
      </div>

      <Suspense fallback={<div className="h-10" />}>
        <OperationsFilters workCenters={workCenters} />
      </Suspense>

      {operations.length === 0 ? (
        <p className="text-gray-500 mt-4">No operations found / لا توجد عمليات</p>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Order / الأمر</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Model / الموديل</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">WC / مركز العمل</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Seq</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status / الحالة</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Scheduled / المجدول</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {operations.map((op) => (
                  <tr key={op.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{op.id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-800">{op.orderNumber}</td>
                    <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                      <span className="font-mono text-xs text-gray-500">{op.modelCode}</span>
                      <span className="ml-1">{op.modelNameAr}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                      <span className="font-mono text-xs text-gray-500">{op.workCenterCode}</span>
                      <span className="ml-1">{op.workCenterNameAr}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{op.sequence}</td>
                    <td className="px-4 py-3 text-gray-500">{op.quantity}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        op.status === 'QUEUED' ? 'bg-gray-100 text-gray-600' :
                        op.status === 'IN_PROGRESS' ? 'bg-green-100 text-green-700' :
                        op.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' :
                        op.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                        op.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-700' :
                        op.status === 'PENDING_QC' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {op.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                      {op.scheduledStart ? `${op.scheduledStart.slice(5, 10)} ${op.scheduledStart.slice(11, 16)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <OperationsActions operationId={op.id} status={op.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            basePath="/admin/operations"
            params={{
              ...(params.status ? { status: params.status } : {}),
              ...(params.wc ? { wc: params.wc } : {}),
              ...(params.q ? { q: params.q } : {}),
            }}
          />
        </>
      )}
    </div>
  );
}