import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import {
  model,
  workCenter,
  workOrder,
  workOrderLine,
  workOrderOperation,
} from '@/db/schema';
import { releaseWorkOrderAction } from '../actions';
import { OrderLinesEditor } from './OrderLinesEditor';
import { PrintOrderLabel } from './print-label';

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);

  const [order] = await db
    .select()
    .from(workOrder)
    .where(eq(workOrder.id, orderId));

  if (!order) notFound();

  const lines = await db
    .select({
      id: workOrderLine.id,
      modelId: workOrderLine.modelId,
      modelCode: model.code,
      modelNameAr: model.nameAr,
      modelNameEn: model.nameEn,
      quantity: workOrderLine.quantity,
    })
    .from(workOrderLine)
    .innerJoin(model, eq(model.id, workOrderLine.modelId))
    .where(eq(workOrderLine.workOrderId, orderId))
    .orderBy(asc(model.code));

  const operations = await db
    .select({
      id: workOrderOperation.id,
      sequence: workOrderOperation.sequence,
      workCenterCode: workCenter.code,
      workCenterNameAr: workCenter.nameAr,
      status: workOrderOperation.status,
      scheduledStart: workOrderOperation.scheduledStart,
      scheduledEnd: workOrderOperation.scheduledEnd,
    })
    .from(workOrderOperation)
    .innerJoin(workCenter, eq(workCenter.id, workOrderOperation.workCenterId))
    .innerJoin(workOrderLine, eq(workOrderLine.id, workOrderOperation.workOrderLineId))
    .where(eq(workOrderLine.workOrderId, orderId))
    .orderBy(asc(workOrderOperation.sequence));

  const models = await db
    .select({ id: model.id, code: model.code, nameEn: model.nameEn })
    .from(model)
    .orderBy(asc(model.code));

  const statusBadge = (s: string) => {
    const cls =
      s === 'DRAFT'
        ? 'bg-gray-100 text-gray-600'
        : s === 'RELEASED'
          ? 'bg-blue-100 text-blue-700'
          : s === 'IN_PROGRESS'
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-green-100 text-green-700';
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
        {s}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/orders"
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          &larr; Orders / الطلبات
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">
          {order.orderNumber}
        </h1>
        {statusBadge(order.status)}
        <div className="ml-auto">
          <PrintOrderLabel
            orderNumber={order.orderNumber}
            modelInfo={lines.map(l => `${l.modelCode} — ${l.modelNameAr}`).join(', ')}
            totalQty={lines.reduce((s, l) => s + l.quantity, 0)}
            createdAt={order.createdAt ?? null}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Status / الحالة
          </p>
          <p className="text-sm font-medium text-gray-900">{order.status}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Created / تاريخ الإنشاء
          </p>
          <p className="text-sm font-medium text-gray-900">
            {order.createdAt
              ? new Date(order.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '—'}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Released / تاريخ الإصدار
          </p>
          <p className="text-sm font-medium text-gray-900">
            {order.releasedAt
              ? new Date(order.releasedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '—'}
          </p>
        </div>
      </div>

      {order.status === 'DRAFT' && (
        <div className="mb-8">
          <form action={releaseWorkOrderAction}>
            <input type="hidden" name="orderId" value={order.id} />
            <button
              type="submit"
              className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Release Order / إصدار الأمر
            </button>
          </form>
        </div>
      )}

      {order.status === 'RELEASED' && (
        <div className="mb-8">
          <Link
            href={`/admin/scheduler?orderId=${order.id}`}
            className="bg-green-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors inline-block"
          >
            View in Scheduler / عرض في الجدولة
          </Link>
        </div>
      )}

      {order.status === 'IN_PROGRESS' && (
        <div className="mb-8">
          <Link
            href={`/admin/scheduler?orderId=${order.id}`}
            className="bg-green-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors inline-block"
          >
            View in Scheduler / عرض في الجدولة
          </Link>
        </div>
      )}

      <OrderLinesEditor
        orderId={order.id}
        initialLines={lines}
        allModels={models}
        status={order.status}
      />

      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Operations / العمليات
        </h2>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Seq / التسلسل
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Work Center / مركز العمل
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status / الحالة
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Scheduled / المجدول
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {operations.map((op) => (
                <tr key={op.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-800">{op.sequence}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-gray-500">
                      {op.workCenterCode}
                    </span>
                    <span className="ml-2 text-gray-800">
                      {op.workCenterNameAr}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        op.status === 'QUEUED'
                          ? 'bg-gray-100 text-gray-600'
                          : op.status === 'IN_PROGRESS'
                            ? 'bg-yellow-100 text-yellow-700'
                            : op.status === 'COMPLETED'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {op.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {op.scheduledStart
                      ? `${new Date(op.scheduledStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — ${new Date(op.scheduledEnd!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                      : '—'}
                  </td>
                </tr>
              ))}
              {operations.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-sm text-gray-400"
                  >
                    No operations / لا توجد عمليات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
