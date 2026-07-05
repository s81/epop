'use client';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateOrderLines } from '../actions';

type Line = {
  modelCode: string;
  modelNameAr: string;
  modelNameEn: string;
  quantity: number;
  modelId?: number;
};

type Model = {
  id: number;
  code: string;
  nameEn: string;
};

export function OrderLinesEditor({
  orderId,
  initialLines,
  allModels,
  status,
}: {
  orderId: number;
  initialLines: Line[];
  allModels: Model[];
  status: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [lines, setLines] = useState<{ modelId: string; quantity: string; key: number }[]>([]);
  const [state, formAction, pending] = useActionState(updateOrderLines, null);

  useEffect(() => {
    if (state && 'success' in state) {
      setEditing(false);
      setLines([]);
      router.refresh();
    }
  }, [state, router]);

  if (status !== 'DRAFT') {
    return (
      <section className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Lines / البنود
        </h2>
        <ReadOnlyTable lines={initialLines} />
      </section>
    );
  }

  if (!editing) {
    return (
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">
            Lines / البنود
          </h2>
          <button
            onClick={() => {
              setLines(
                initialLines.length > 0
                  ? initialLines.map((l) => ({
                      modelId: String(l.modelId ?? ''),
                      quantity: String(l.quantity),
                      key: Math.random(),
                    }))
                  : [{ modelId: '', quantity: '1', key: Math.random() }],
              );
              setEditing(true);
            }}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Edit / تعديل
          </button>
        </div>
        {initialLines.length > 0 ? (
          <ReadOnlyTable lines={initialLines} />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-10 text-center text-sm text-gray-400">
            No lines / لا توجد بنود
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold text-gray-900 mb-3">
        Lines / البنود
      </h2>
      <form action={formAction}>
        <input type="hidden" name="orderId" value={orderId} />
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Model / الموديل
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
                      {allModels.map((m) => (
                        <option key={m.id} value={String(m.id)}>
                          {m.code} — {m.nameEn}
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
                  <td
                    colSpan={3}
                    className="px-4 py-10 text-center text-sm text-gray-400"
                  >
                    No lines / لا توجد بنود
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {state && 'error' in state && (
          <p className="text-red-500 text-sm mt-2">{state.error}</p>
        )}

        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={() =>
              setLines([
                ...lines,
                { modelId: '', quantity: '1', key: Math.random() },
              ])
            }
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            + Add Line / + إضافة بند
          </button>
          <button
            type="submit"
            disabled={pending}
            className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {pending ? 'Saving… / جاري الحفظ…' : 'Save / حفظ'}
          </button>
          <button
            type="button"
            onClick={() => {
              setLines([]);
              setEditing(false);
            }}
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Cancel / إلغاء
          </button>
        </div>
      </form>
    </section>
  );
}

function ReadOnlyTable({ lines }: { lines: Line[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Model / الموديل
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Qty / الكمية
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {lines.map((line, i) => (
            <tr key={i} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <span className="font-mono text-xs text-gray-500">
                  {line.modelCode}
                </span>
                <span className="ml-2 text-gray-800">
                  {line.modelNameEn} / {line.modelNameAr}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-800">{line.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
