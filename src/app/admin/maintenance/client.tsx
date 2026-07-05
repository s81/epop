'use client';
import { useTransition, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { MaintenanceCategory, MaintenanceStatus } from '@/db/schema';
import type { resolveMaintenanceAction } from './actions';
import { ExportCsv } from '@/components/admin/ExportCsv';
import { Pagination } from '@/components/admin/Pagination';

type Row = {
  id: number;
  workCenterNameAr: string;
  workCenterCode: string;
  category: MaintenanceCategory;
  note: string | null;
  reportedBy: string;
  status: MaintenanceStatus;
  createdAt: string;
};

const CATEGORY_LABEL: Record<MaintenanceCategory, string> = {
  MECHANICAL: 'ميكانيكي / Mechanical',
  ELECTRICAL: 'كهربائي / Electrical',
  TOOLING:    'أدوات / Tooling',
  OTHER:      'أخرى / Other',
};

const CATEGORY_COLOR: Record<MaintenanceCategory, string> = {
  MECHANICAL: 'bg-orange-900 text-orange-300',
  ELECTRICAL: 'bg-yellow-900 text-yellow-300',
  TOOLING:    'bg-purple-900 text-purple-300',
  OTHER:      'bg-gray-700 text-gray-300',
};

type Filter = 'ALL' | 'OPEN' | 'RESOLVED';

export function MaintenanceClient({
  data,
  onResolve,
  currentPage,
  totalPages,
}: {
  data: Row[];
  onResolve: typeof resolveMaintenanceAction;
  currentPage: number;
  totalPages: number;
}) {
  const pathname = usePathname();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [isPending, startTransition] = useTransition();

  const filtered = filter === 'ALL' ? data : data.filter((r) => r.status === filter);

  function handleResolve(id: number) {
    startTransition(async () => {
      await onResolve(id);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Maintenance Requests / طلبات الصيانة</h1>
        <div className="flex gap-2 items-center">
          <ExportCsv
            data={filtered.map(r => ({
              id: r.id,
              workCenter: `${r.workCenterCode} — ${r.workCenterNameAr}`,
              category: CATEGORY_LABEL[r.category],
              note: r.note ?? '',
              status: r.status,
              reportedBy: r.reportedBy,
              createdAt: r.createdAt.slice(0, 16).replace('T', ' '),
            }))}
            filename="maintenance.csv"
            headers={{
              id: 'ID',
              workCenter: 'Work Center / مركز العمل',
              category: 'Category / الفئة',
              note: 'Note / الملاحظة',
              status: 'Status / الحالة',
              reportedBy: 'Reported By / المبلغ',
              createdAt: 'Created / تاريخ الإنشاء',
            }}
          />
          {(['ALL', 'OPEN', 'RESOLVED'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {f === 'ALL' ? 'All' : f === 'OPEN' ? 'Open' : 'Resolved'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500">No records.</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left">
                <th className="pb-2 pr-4 w-10">ID</th>
                <th className="pb-2 pr-4">Work Center</th>
                <th className="pb-2 pr-4">Category</th>
                <th className="pb-2 pr-4">Note</th>
                <th className="pb-2 pr-4">Reporter</th>
                <th className="pb-2 pr-4">Time</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                  <td className="py-3 pr-4 text-gray-500 font-mono text-xs">{row.id}</td>
                  <td className="py-3 pr-4">
                    <div className="font-medium">{row.workCenterNameAr}</div>
                    <div className="text-gray-500 text-xs">{row.workCenterCode}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLOR[row.category]}`}>
                      {CATEGORY_LABEL[row.category]}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-300 max-w-xs truncate">
                    {row.note ?? <span className="text-gray-600">—</span>}
                  </td>
                  <td className="py-3 pr-4 text-gray-400">{row.reportedBy}</td>
                  <td className="py-3 pr-4 text-gray-400 font-mono text-xs whitespace-nowrap">
                    {row.createdAt.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="py-3">
                    {row.status === 'OPEN' ? (
                      <button
                        onClick={() => handleResolve(row.id)}
                        disabled={isPending}
                        className="px-3 py-1 rounded text-xs font-medium bg-green-800 text-green-200 hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        Mark Resolved / تم الحل
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500">Resolved</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            basePath={pathname}
            params={{}}
          />
        </>
      )}
    </div>
  );
}
