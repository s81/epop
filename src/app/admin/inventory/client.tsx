'use client';
import { useActionState, useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import type { recordReceipt, recordIssue, recordAdjustment } from './actions';

type MaterialRow = {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string;
  unit: string;
  categoryName: string;
  stock: number;
};

type TransactionRow = {
  id: number;
  materialId: number;
  type: 'RECEIPT' | 'ISSUE' | 'ADJUSTMENT';
  quantity: number;
  reference: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  materialCode: string;
  materialNameEn: string;
};

const TX_TYPE_COLOR: Record<string, string> = {
  RECEIPT: 'bg-green-100 text-green-700',
  ISSUE: 'bg-red-100 text-red-700',
  ADJUSTMENT: 'bg-yellow-100 text-yellow-700',
};

function TxForm({
  title,
  action,
  materials,
  workOrders,
  showWorkOrder,
  onSuccess,
  onCancel,
}: {
  title: string;
  action: typeof recordReceipt | typeof recordIssue | typeof recordAdjustment;
  materials: MaterialRow[];
  workOrders?: { id: number; orderNumber: string }[];
  showWorkOrder?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state && 'success' in state) onSuccess();
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Material / المادة</label>
        <select
          name="materialId"
          required
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">— Select —</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>{m.code} — {m.nameEn}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity / الكمية</label>
        <input
          name="quantity"
          type="number"
          step="0.01"
          min="0"
          required
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {showWorkOrder && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Work Order / أمر العمل</label>
          <select
            name="workOrderId"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">— Optional —</option>
            {workOrders?.map((wo) => (
              <option key={wo.id} value={wo.id}>{wo.orderNumber}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {showWorkOrder ? 'Note / ملاحظة' : 'Reference / المرجع'}
        </label>
        <input
          name={showWorkOrder ? 'note' : 'reference'}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {!showWorkOrder && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Note / ملاحظة</label>
          <input
            name="note"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {state && 'error' in state && (
        <p className="text-red-500 text-sm">{state.error}</p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
          Cancel / إلغاء
        </button>
        <button
          type="submit"
          disabled={pending}
          className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? 'Recording…' : 'Record / تسجيل'}
        </button>
      </div>
    </form>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function InventoryClient({
  materials,
  transactions,
  workOrders,
  onReceipt,
  onIssue,
  onAdjustment,
}: {
  materials: MaterialRow[];
  transactions: TransactionRow[];
  workOrders: { id: number; orderNumber: string }[];
  onReceipt: typeof recordReceipt;
  onIssue: typeof recordIssue;
  onAdjustment: typeof recordAdjustment;
}) {
  const [dialog, setDialog] = useState<{ open: boolean; type: 'RECEIPT' | 'ISSUE' | 'ADJUSTMENT' | null }>({ open: false, type: null });
  const close = () => setDialog({ open: false, type: null });

  const lowStock = materials.filter((m) => m.stock <= 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Inventory / المخزون</h1>
      </div>

      {lowStock.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          ⚠ {lowStock.length} material(s) with zero or negative stock
        </div>
      )}

      {/* Stock Levels Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name / الاسم</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit / الوحدة</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category / الفئة</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock / المخزون</th>
              <th className="px-4 py-3 w-40" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {materials.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                  No materials yet / لا توجد مواد بعد
                </td>
              </tr>
            )}
            {materials.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{m.code}</td>
                <td className="px-4 py-3 text-gray-800">
                  <span className="font-medium">{m.nameEn}</span>
                  <span className="text-gray-500 ml-1">/ {m.nameAr}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">{m.unit}</td>
                <td className="px-4 py-3 text-gray-600">{m.categoryName}</td>
                <td className={`px-4 py-3 font-mono font-semibold ${m.stock <= 0 ? 'text-red-600' : 'text-gray-800'}`}>
                  {m.stock}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setDialog({ open: true, type: 'RECEIPT' })}
                      className="text-[11px] bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 font-medium transition-colors"
                    >
                      Receipt
                    </button>
                    <button
                      onClick={() => setDialog({ open: true, type: 'ISSUE' })}
                      className="text-[11px] bg-red-50 text-red-700 px-2 py-1 rounded hover:bg-red-100 font-medium transition-colors"
                    >
                      Issue
                    </button>
                    <button
                      onClick={() => setDialog({ open: true, type: 'ADJUSTMENT' })}
                      className="text-[11px] bg-yellow-50 text-yellow-700 px-2 py-1 rounded hover:bg-yellow-100 font-medium transition-colors"
                    >
                      Adjust
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Transaction Log */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-700 px-4 py-3 border-b border-gray-200">
          Recent Transactions / آخر المعاملات
        </h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date / التاريخ</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Material / المادة</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type / النوع</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty / الكمية</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference / المرجع</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Note / ملاحظة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                  No transactions yet / لا توجد معاملات بعد
                </td>
              </tr>
            )}
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">{formatTime(tx.createdAt)}</td>
                <td className="px-4 py-3 text-gray-800">
                  <span className="font-mono text-xs text-gray-500">{tx.materialCode}</span>
                  <span className="ml-1">{tx.materialNameEn}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TX_TYPE_COLOR[tx.type]}`}>
                    {tx.type}
                  </span>
                </td>
                <td className={`px-4 py-3 font-mono ${tx.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{tx.reference ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{tx.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={dialog.open}
        onClose={close}
        title={
          dialog.type === 'RECEIPT' ? 'Record Receipt / تسجيل استلام' :
          dialog.type === 'ISSUE' ? 'Record Issue / تسجيل صرف' :
          dialog.type === 'ADJUSTMENT' ? 'Record Adjustment / تسجيل تعديل' :
          ''
        }
      >
        {dialog.type === 'RECEIPT' && (
          <TxForm title="Receipt" action={onReceipt} materials={materials} onSuccess={close} onCancel={close} />
        )}
        {dialog.type === 'ISSUE' && (
          <TxForm title="Issue" action={onIssue} materials={materials} workOrders={workOrders} showWorkOrder onSuccess={close} onCancel={close} />
        )}
        {dialog.type === 'ADJUSTMENT' && (
          <TxForm title="Adjustment" action={onAdjustment} materials={materials} onSuccess={close} onCancel={close} />
        )}
      </Dialog>
    </div>
  );
}
