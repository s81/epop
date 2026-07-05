import Link from 'next/link';
import { and, desc, eq, gte, like, lte, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { model, workOrder, workOrderLine } from '@/db/schema';
import { OrdersFilters } from './filters';
import { OrdersTable } from './orders-table';
import { OrdersExportButton } from './orders-export';
import { Pagination } from '@/components/admin/Pagination';

const PAGE_SIZE = 50;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; from?: string; to?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const conditions: ReturnType<typeof and>[] = [];

  if (params.q) {
    conditions.push(like(workOrder.orderNumber, `%${params.q}%`));
  }
  if (params.status) {
    conditions.push(eq(workOrder.status, params.status as typeof workOrder.status.enumValues[number]));
  }
  if (params.from) {
    conditions.push(gte(workOrder.createdAt, params.from));
  }
  if (params.to) {
    conditions.push(lte(workOrder.createdAt, params.to + 'T23:59:59'));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [orders, countResult] = await Promise.all([
    db
      .select({
        id: workOrder.id,
        orderNumber: workOrder.orderNumber,
        status: workOrder.status,
        createdAt: workOrder.createdAt,
        releasedAt: workOrder.releasedAt,
        lineCount: sql<number>`count(${workOrderLine.id})`.mapWith(Number),
        modelCodes: sql<string>`coalesce(group_concat(${model.code}, ', '), '')`,
        totalQuantity: sql<number>`coalesce(sum(${workOrderLine.quantity}), 0)`.mapWith(Number),
      })
      .from(workOrder)
      .leftJoin(workOrderLine, eq(workOrderLine.workOrderId, workOrder.id))
      .leftJoin(model, eq(model.id, workOrderLine.modelId))
      .groupBy(workOrder.id)
      .orderBy(desc(workOrder.createdAt))
      .where(where)
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(workOrder)
      .where(where),
  ]);

  const totalCount = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Orders / الطلبات</h1>
        <div className="flex gap-3">
          <OrdersExportButton orders={orders} />
          <Link
            href="/admin/orders/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + New Order
          </Link>
        </div>
      </div>

      <OrdersFilters q={params.q} status={params.status} from={params.from} to={params.to} />

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Order / رقم الأمر
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Model / الموديل
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Qty / الكمية
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Status / الحالة
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Created / تاريخ الإنشاء
              </th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-gray-400"
                >
                  {(params.q || params.status || params.from || params.to)
                    ? 'No orders match your filters / لا توجد طلبات تطابق البحث'
                    : 'No orders yet / لا توجد طلبات'}
                </td>
              </tr>
            )}
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-800 font-mono text-xs">
                  {order.orderNumber}
                </td>
                <td className="px-4 py-3 text-gray-800">{order.modelCodes}</td>
                <td className="px-4 py-3 text-gray-800">{order.totalQuantity}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      order.status === 'DRAFT'
                        ? 'bg-gray-100 text-gray-600'
                        : order.status === 'RELEASED'
                          ? 'bg-blue-100 text-blue-700'
                          : order.status === 'IN_PROGRESS'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {order.createdAt
                    ? new Date(order.createdAt).toLocaleDateString('en-GB')
                    : ''}
                </td>
                <td className="px-4 py-3">
                  <OrdersTable
                    id={order.id}
                    status={order.status}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          basePath="/admin/orders"
          params={{
            ...(params.q ? { q: params.q } : {}),
            ...(params.status ? { status: params.status } : {}),
            ...(params.from ? { from: params.from } : {}),
            ...(params.to ? { to: params.to } : {}),
          }}
        />
      )}
    </div>
  );
}
