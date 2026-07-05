'use client';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createWorkOrder } from '../actions';

export function NewOrderForm({
  models,
  colors,
}: {
  models: { id: number; code: string; nameAr: string; nameEn: string }[];
  colors: { id: number; code: string; nameEn: string }[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createWorkOrder, null);
  const [lines, setLines] = useState<{ modelId: string; quantity: string; colorId: string; key: number }[]>([
    { modelId: '', quantity: '1', colorId: '', key: Math.random() },
  ]);

  useEffect(() => {
    if (state && 'success' in state) {
      router.push('/admin/orders');
    }
  }, [state, router]);

  return (
    <form action={formAction}>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Model / الموديل
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Color / اللون
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Qty / الكمية
              </th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map((line, i) => (
              <tr key={line.key}>
                <td className="px-4 py-3">
                  <select
                    name="modelId"
                    value={line.modelId}
                    onChange={(e) => {
                      const next = [...lines];
                      next[i] = { ...next[i], modelId: e.target.value };
                      setLines(next);
                    }}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">— Select —</option>
                    {models.map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.code} — {m.nameEn}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    name="colorId"
                    value={line.colorId}
                    onChange={(e) => {
                      const next = [...lines];
                      next[i] = { ...next[i], colorId: e.target.value };
                      setLines(next);
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">— None —</option>
                    {colors.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.code} — {c.nameEn}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    required
                    value={line.quantity}
                    onChange={(e) => {
                      const next = [...lines];
                      next[i] = { ...next[i], quantity: e.target.value };
                      setLines(next);
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setLines(lines.filter((_, j) => j !== i))}
                    className="text-red-500 hover:text-red-700 text-lg font-medium"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">
                  No lines / لا توجد بنود
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={() =>
          setLines([...lines, { modelId: '', quantity: '1', colorId: '', key: Math.random() }])
        }
        className="mb-4 px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
      >
        + Add Line / + إضافة بند
      </button>

      {state && 'error' in state && (
        <p className="text-red-500 text-sm mb-3">{state.error}</p>
      )}

      <div className="flex justify-end pt-2 gap-3">
        <button
          type="button"
          onClick={() => router.push('/admin/orders')}
          className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          Cancel / إلغاء
        </button>
        <button
          type="submit"
          disabled={pending}
          className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Creating… / جاري الإنشاء…' : 'Create / إنشاء'}
        </button>
      </div>
    </form>
  );
}