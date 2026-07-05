'use client';
import Link from 'next/link';
import { deleteWorkOrder, releaseWorkOrderAction } from './actions';

export function OrdersTable({
  id,
  status,
}: {
  id: number;
  status: string;
}) {
  return (
    <div className="flex gap-3 justify-end">
      <Link
        href={`/admin/orders/${id}`}
        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
      >
        View
      </Link>
      {status === 'DRAFT' && (
        <>
          <form action={releaseWorkOrderAction} className="inline">
            <input type="hidden" name="orderId" value={id} />
            <button
              type="submit"
              className="text-green-600 hover:text-green-800 text-xs font-medium"
            >
              Release
            </button>
          </form>
          <form action={deleteWorkOrder} className="inline">
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              className="text-red-500 hover:text-red-700 text-xs font-medium"
              onClick={(e) => {
                if (!confirm('Delete this order? / حذف هذا الأمر؟')) {
                  e.preventDefault();
                }
              }}
            >
              Delete
            </button>
          </form>
        </>
      )}
    </div>
  );
}
