'use client';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { upsertTarget } from './actions';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ARABIC_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

type WorkCenter = { id: number; code: string; nameAr: string; nameEn: string };
type Day = { day: number; dayName: string; dateStr: string };
type TargetRow = { id: number; workCenterId: number; date: string; targetQuantity: number };

function TargetForm({
  workCenter,
  date,
  target,
  onSuccess,
  onCancel,
}: {
  workCenter: WorkCenter;
  date: string;
  target: TargetRow | undefined;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(upsertTarget, null);

  const router = useRouter();

  useEffect(() => {
    if (state && 'success' in state) {
      onSuccess();
      router.refresh();
    }
  }, [state, onSuccess, router]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="workCenterId" value={workCenter.id} />
      <input type="hidden" name="date" value={date} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Work Center / مركز العمل</label>
        <p className="text-sm text-gray-800">{workCenter.code} — {workCenter.nameAr}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date / التاريخ</label>
        <p className="text-sm text-gray-800 font-mono">{date}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Target Quantity / الكمية المستهدفة</label>
        <input
          type="number"
          name="targetQuantity"
          defaultValue={target?.targetQuantity ?? 0}
          min={0}
          required
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {state && 'error' in state && (
        <p className="text-red-500 text-sm">{state.error}</p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancel / إلغاء
        </button>
        <button
          type="submit"
          disabled={pending}
          className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Saving…' : 'Save / حفظ'}
        </button>
      </div>
    </form>
  );
}

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function TargetsClient({
  workCenters,
  days,
  targetMap,
  actualMap,
  month,
}: {
  workCenters: WorkCenter[];
  days: Day[];
  targetMap: Record<string, TargetRow>;
  actualMap: Record<string, number>;
  month: string;
}) {
  const [modal, setModal] = useState<{ workCenter: WorkCenter; day: Day } | null>(null);

  const [y, m] = month.split('-').map(Number);
  const monthLabel = `${MONTH_NAMES[m - 1]} ${y} / ${ARABIC_MONTHS[m - 1]} ${y}`;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Production Targets / أهداف الإنتاج</h1>

      <div className="flex items-center justify-between mb-4">
        <a
          href={`?month=${prevMonth(month)}`}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          &larr; {MONTH_NAMES[(m - 2 + 12) % 12]}
        </a>
        <span className="text-sm font-semibold text-gray-700">{monthLabel}</span>
        <a
          href={`?month=${nextMonth(month)}`}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          {MONTH_NAMES[m % 12]} &rarr;
        </a>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Set Target / تحديد الهدف</h2>
            <TargetForm
              workCenter={modal.workCenter}
              date={modal.day.dateStr}
              target={targetMap[`${modal.workCenter.id}-${modal.day.dateStr}`]}
              onSuccess={() => setModal(null)}
              onCancel={() => setModal(null)}
            />
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50 z-10">
                Day / اليوم
              </th>
              {workCenters.map((wc) => (
                <th key={wc.id} className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[100px]">
                  {wc.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {days.map((day) => (
              <tr key={day.dateStr} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2 text-xs text-gray-500 font-mono sticky left-0 bg-white z-10">
                  {day.dateStr.slice(-2)} {day.dayName}
                </td>
                {workCenters.map((wc) => {
                  const key = `${wc.id}-${day.dateStr}`;
                  const target = targetMap[key];
                  const actual = actualMap[key] ?? 0;
                  return (
                    <td
                      key={wc.id}
                      className="px-3 py-2 text-center cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() => setModal({ workCenter: wc, day })}
                    >
                      <div className="text-sm font-semibold text-gray-800">
                        {target ? target.targetQuantity : '—'}
                      </div>
                      <div className="text-xs text-gray-400">{actual}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
