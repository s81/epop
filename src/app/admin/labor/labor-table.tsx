'use client';
import { useState } from 'react';

const PAGE_SIZE = 20;

const WEEKDAYS = [
  'Mon / الإثنين',
  'Tue / الثلاثاء',
  'Wed / الأربعاء',
  'Thu / الخميس',
  'Fri / الجمعة',
  'Sat / السبت',
  'Sun / الأحد',
];

function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type Detail = { date: string; operationId: number; workCenterCode: string; orderNumber: string; modelCode: string; minutes: number };

export function LaborTable({
  byOperator,
  operatorTotals,
  sortedOperators,
  dates,
}: {
  byOperator: Map<string, Map<string, { minutes: number; details: Detail[] }>>;
  operatorTotals: Map<string, number>;
  sortedOperators: string[];
  dates: Date[];
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(sortedOperators.length / PAGE_SIZE);
  const paged = sortedOperators.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Operator ID / معرف المشغل
              </th>
              {dates.map((d, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {WEEKDAYS[i]}<br />
                  <span className="text-gray-400 font-normal">{formatDate(d)}</span>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Total / المجموع
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map((opId) => {
              const dayMap = byOperator.get(opId)!;
              let weekTotal = 0;
              const dayMinutes = dates.map((d) => {
                const ds = formatDate(d);
                const entry = dayMap.get(ds);
                const m = entry?.minutes ?? 0;
                weekTotal += m;
                return m;
              });
              return (
                <tr key={opId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-800 font-mono font-medium">{opId}</td>
                  {dayMinutes.map((m, i) => (
                    <td key={i} className="px-4 py-3 text-gray-800 font-mono">
                      {m > 0 ? fmtHours(m) : '—'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-gray-800 font-mono font-semibold">
                    {fmtHours(weekTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-200">
            <tr>
              <td className="px-4 py-3 text-xs font-semibold text-gray-600" colSpan={dates.length + 1}>
                {sortedOperators.length} operators · Page {page + 1} of {totalPages || 1}
              </td>
              <td className="px-4 py-3 text-xs font-semibold text-gray-600">
                {fmtHours(Array.from(operatorTotals.values()).reduce((s, v) => s + v, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous / السابق
          </button>
          <span className="text-sm text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next / التالي
          </button>
        </div>
      )}
    </div>
  );
}