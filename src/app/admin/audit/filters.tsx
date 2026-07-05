'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

const EVENT_TYPES = [
  { value: 'START',  label: 'بدء / Start' },
  { value: 'PAUSE',  label: 'إيقاف / Pause' },
  { value: 'RESUME', label: 'استئناف / Resume' },
  { value: 'FINISH', label: 'إنهاء / Finish' },
  { value: 'ACCEPT', label: 'قبول / Accept' },
  { value: 'REJECT', label: 'رفض / Reject' },
  { value: 'RESTART',label: 'إعادة / Rework' },
];

export function AuditFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const eventType = searchParams.get('eventType') ?? '';
  const operatorId = searchParams.get('operatorId') ?? '';
  const workCenterCode = searchParams.get('workCenterCode') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';

  function buildParams() {
    const p = new URLSearchParams();
    const form = document.querySelector<HTMLFormElement>('form');
    if (!form) return p;
    const data = new FormData(form);
    for (const [key, value] of data.entries()) {
      if (value) p.set(key, value as string);
    }
    return p;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const p = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (value) p.set(key, value as string);
    }
    router.push(`${pathname}${p.toString() ? '?' + p.toString() : ''}`);
  }

  function handleClear() {
    router.push(pathname);
  }

  const hasFilters = eventType || operatorId || workCenterCode || from || to;

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3 mb-4">
      <select
        name="eventType"
        defaultValue={eventType}
        className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-1.5"
      >
        <option value="">All Events / جميع الأحداث</option>
        {EVENT_TYPES.map((e) => (
          <option key={e.value} value={e.value}>{e.label}</option>
        ))}
      </select>

      <input
        name="operatorId"
        type="text"
        defaultValue={operatorId}
        placeholder="Operator ID / معرف المشغل"
        className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-1.5 w-40"
      />

      <input
        name="workCenterCode"
        type="text"
        defaultValue={workCenterCode}
        placeholder="Work Center / مركز العمل"
        className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-1.5 w-40"
      />

      <input
        name="from"
        type="date"
        defaultValue={from}
        className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-1.5"
      />

      <input
        name="to"
        type="date"
        defaultValue={to}
        className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-1.5"
      />

      <button
        type="submit"
        className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded transition-colors"
      >
        Filter / تصفية
      </button>

      {hasFilters && (
        <button
          type="button"
          onClick={handleClear}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Clear / مسح
        </button>
      )}
    </form>
  );
}
