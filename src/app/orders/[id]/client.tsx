'use client';
import { useState, useActionState } from 'react';
import Link from 'next/link';
import { Dialog } from '@/components/ui/Dialog';
import { LineForm } from './form';
import type { InferSelectModel } from 'drizzle-orm';
import type { workOrder } from '@/db/schema';
import type { WorkOrderStatus } from '@/db/schema';
import type { addLine, deleteLine, releaseOrderAction } from './actions';

type Order = InferSelectModel<typeof workOrder>;
type Line = {
  id: number;
  modelId: number;
  modelCode: string;
  modelNameEn: string;
  colorId: number | null;
  colorNameEn: string | null;
  quantity: number;
};
type Model = { id: number; code: string; nameEn: string };
type Color = { id: number; code: string; nameEn: string };

const STATUS_BADGE: Record<WorkOrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  RELEASED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
};

export function OrderDetailClient({
  order,
  lines,
  models,
  colors,
  onAddLine,
  onDeleteLine,
  onRelease,
}: {
  order: Order;
  lines: Line[];
  models: Model[];
  colors: Color[];
  onAddLine: typeof addLine;
  onDeleteLine: typeof deleteLine;
  onRelease: typeof releaseOrderAction;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [releaseState, releaseAction] = useActionState(onRelease, null);
  const isDraft = order.status === 'DRAFT';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <Link href="/orders" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Orders
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-semibold text-gray-900 font-mono">{order.orderNumber}</h1>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[order.status]}`}
        >
          {order.status}
        </span>
        {isDraft && (
          <div className="ml-auto flex flex-col items-end gap-1">
            <form action={releaseAction}>
              <input type="hidden" name="id" value={order.id} />
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Release →
              </button>
            </form>
            {releaseState?.error && (
              <p className="text-red-500 text-xs max-w-xs text-right">{releaseState.error}</p>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-6">
        Created {order.createdAt.slice(0, 10)}
        {order.releasedAt && ` · Released ${order.releasedAt.slice(0, 10)}`}
      </p>

      {/* Lines */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">Lines / بنود</h2>
        {isDraft && (
          <button
            onClick={() => setDialogOpen(true)}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-blue-700 transition-colors"
          >
            + Add Line
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Model / النموذج
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Color / اللون
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">
                Qty
              </th>
              {isDraft && <th className="px-4 py-3 w-16" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.length === 0 && (
              <tr>
                <td
                  colSpan={isDraft ? 4 : 3}
                  className="px-4 py-10 text-center text-sm text-gray-400"
                >
                  No lines yet — click "+ Add Line" to add models to this order
                </td>
              </tr>
            )}
            {lines.map((line) => (
              <tr key={line.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {line.modelCode} — {line.modelNameEn}
                </td>
                <td className="px-4 py-3 text-gray-600">{line.colorNameEn ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700">{line.quantity}</td>
                {isDraft && (
                  <td className="px-4 py-3">
                    <form action={onDeleteLine} className="inline">
                      <input type="hidden" name="lineId" value={line.id} />
                      <input type="hidden" name="workOrderId" value={order.id} />
                      <button
                        type="submit"
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                        onClick={(e) => {
                          if (!confirm('Delete this line?')) e.preventDefault();
                        }}
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Add Line / إضافة بند"
      >
        <LineForm
          key={dialogOpen ? 'open' : 'closed'}
          workOrderId={order.id}
          models={models}
          colors={colors}
          onSuccess={() => setDialogOpen(false)}
          onAddLine={onAddLine}
        />
      </Dialog>
    </div>
  );
}
