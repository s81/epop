import { asc, count, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { workOrder, workOrderLine } from '@/db/schema';
import { OrdersClient } from './client';
import { createWorkOrder, deleteWorkOrder } from './actions';

export default async function OrdersPage() {
  const orders = await db
    .select({
      id: workOrder.id,
      orderNumber: workOrder.orderNumber,
      status: workOrder.status,
      createdAt: workOrder.createdAt,
      lineCount: count(workOrderLine.id),
    })
    .from(workOrder)
    .leftJoin(workOrderLine, eq(workOrderLine.workOrderId, workOrder.id))
    .groupBy(workOrder.id)
    .orderBy(asc(workOrder.createdAt));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Work Orders / أوامر العمل
        </h1>
        <form action={createWorkOrder}>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + New Work Order
          </button>
        </form>
      </div>
      <OrdersClient orders={orders} onDelete={deleteWorkOrder} />
    </div>
  );
}
