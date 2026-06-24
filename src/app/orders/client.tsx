'use client';
import Link from 'next/link';
import type { deleteWorkOrder } from './actions';
import type { WorkOrderStatus } from '@/db/schema';

type OrderRow = {
  id: number;
  orderNumber: string;
  status: WorkOrderStatus;
  createdAt: string;
  lineCount: number;
};

const STATUS_BADGE: Record<WorkOrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  RELEASED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
};

export function OrdersClient({
  orders,
  onDelete,
}: {
  orders: OrderRow[];
  onDelete: typeof deleteWorkOrder;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Order #</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Lines</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
            <th className="px-4 py-3 w-32" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                No work orders yet — click "+ New Work Order" to create one
              </td>
            </tr>
          )}
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900 font-mono">{o.orderNumber}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[o.status]}`}>
                  {o.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500">{o.lineCount}</td>
              <td className="px-4 py-3 text-gray-500 text-xs">{o.createdAt.slice(0, 10)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-3 justify-end items-center">
                  <Link
                    href={`/orders/${o.id}`}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    Open →
                  </Link>
                  {o.status === 'DRAFT' && (
                    <form action={onDelete} className="inline">
                      <input type="hidden" name="id" value={o.id} />
                      <button
                        type="submit"
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                        onClick={(e) => {
                          if (!confirm('Delete this work order?')) e.preventDefault();
                        }}
                      >
                        Delete
                      </button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
