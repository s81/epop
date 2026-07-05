'use client';
import { useActionState, useEffect, useState } from 'react';
import { upsertShift, deleteShift, bulkCreateShifts } from './actions';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ARABIC_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

type ShiftRow = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  isWorkingDay: boolean;
};

function ShiftForm({
  item,
  onSuccess,
  onCancel,
}: {
  item?: ShiftRow | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(upsertShift, null);

  useEffect(() => {
    if (state && 'success' in state) onSuccess();
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      {item ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date / التاريخ</label>
          <p className="text-sm text-gray-800 font-mono">{item.date}</p>
          <input type="hidden" name="date" value={item.date} />
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date / التاريخ</label>
          <input
            type="date"
            name="date"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start / البداية</label>
          <input
            type="time"
            name="startTime"
            defaultValue={item?.startTime ?? '08:00'}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End / النهاية</label>
          <input
            type="time"
            name="endTime"
            defaultValue={item?.endTime ?? '16:00'}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          name="isWorkingDay"
          defaultChecked={item?.isWorkingDay ?? true}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">Working Day / يوم عمل</span>
      </label>

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

function BulkForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(bulkCreateShifts, null);

  useEffect(() => {
    if (state && 'success' in state) onSuccess();
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Year / السنة</label>
          <input
            type="number"
            name="year"
            defaultValue={new Date().getFullYear()}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Month / الشهر</label>
          <select
            name="month"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start / البداية</label>
          <input
            type="time"
            name="startTime"
            defaultValue="08:00"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End / النهاية</label>
          <input
            type="time"
            name="endTime"
            defaultValue="16:00"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">Working Days / أيام العمل</legend>
        <div className="flex flex-wrap gap-3">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name, i) => (
            <label key={i} className="flex items-center gap-1.5 text-sm text-gray-700">
              <input
                type="checkbox"
                name="workingDays"
                value={i}
                defaultChecked={i >= 1 && i <= 5}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {name}
            </label>
          ))}
        </div>
      </fieldset>

      {state && 'error' in state && (
        <p className="text-red-500 text-sm">{state.error}</p>
      )}
      {state && 'success' in state && (
        <p className="text-green-600 text-sm">{state.count} shifts created</p>
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
          {pending ? 'Generating…' : 'Generate / إنشاء'}
        </button>
      </div>
    </form>
  );
}

export function ShiftsClient({
  data,
  month,
  onDelete,
}: {
  data: ShiftRow[];
  month: string;
  onDelete: typeof deleteShift;
}) {
  const [editing, setEditing] = useState<ShiftRow | null | 'new'>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const [y, m] = month.split('-').map(Number);
  const monthLabel = `${MONTH_NAMES[m - 1]} ${y} / ${ARABIC_MONTHS[m - 1]} ${y}`;
  const workingDays = data.filter((s) => s.isWorkingDay).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-gray-900">
          Shift Calendar / تقويم المناوبة
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setBulkOpen(true)}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Generate Month / إنشاء شهر
          </button>
          <button
            onClick={() => setEditing('new')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Add Shift / إضافة وردية
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        {data.length} days · {workingDays} working days
      </p>

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

      {editing !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">
              {editing === 'new' ? 'Add Shift / إضافة وردية' : 'Edit Shift / تعديل الوردية'}
            </h2>
            <ShiftForm
              item={editing === 'new' ? null : editing}
              onSuccess={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}

      {bulkOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">
              Generate Month / إنشاء شهر
            </h2>
            <BulkForm
              onSuccess={() => setBulkOpen(false)}
              onCancel={() => setBulkOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Date / التاريخ</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Day / اليوم</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Working / عمل</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Start / البداية</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">End / النهاية</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((s) => {
              const date = new Date(s.date + 'T00:00:00');
              return (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-gray-800">{s.date}</td>
                  <td className="px-4 py-2 text-gray-800">{DAY_NAMES[date.getDay()]}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      s.isWorkingDay ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {s.isWorkingDay ? 'Yes / نعم' : 'No / لا'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500 font-mono">{s.startTime}</td>
                  <td className="px-4 py-2 text-xs text-gray-500 font-mono">{s.endTime}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => setEditing(s)}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      Edit / تعديل
                    </button>
                    <form
                      action={onDelete}
                      className="inline ml-2"
                      onSubmit={(e) => {
                        if (!confirm(`Delete shift for ${s.date}? / حذف وردية ${s.date}؟`)) e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="date" value={s.date} />
                      <button type="submit" className="text-red-600 hover:text-red-800 text-xs font-medium ml-2">
                        Delete / حذف
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No shifts for this month / لا توجد ورديات لهذا الشهر
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
