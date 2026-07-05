'use client';
import { useCallback, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

const STATUSES = ['', 'DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED'] as const;

export function OrdersFilters({
  q: initialQ,
  status: initialStatus,
  from: initialFrom,
  to: initialTo,
}: {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(initialQ ?? searchParams.get('q') ?? '');
  const [status, setStatus] = useState(initialStatus ?? searchParams.get('status') ?? '');
  const [from, setFrom] = useState(initialFrom ?? searchParams.get('from') ?? '');
  const [to, setTo] = useState(initialTo ?? searchParams.get('to') ?? '');

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (status) p.set('status', status);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return p;
  }, [q, status, from, to]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = buildParams();
    router.push(`${pathname}${p.toString() ? '?' + p.toString() : ''}`);
  }

  function handleClear() {
    setQ('');
    setStatus('');
    setFrom('');
    setTo('');
    router.push(pathname);
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">
          Search / بحث
        </label>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Order number / رقم الأمر"
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">
          Status / الحالة
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === '' ? 'All / الكل' : s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">
          From / من
        </label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">
          To / إلى
        </label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        Filter / تصفية
      </button>

      <button
        type="button"
        onClick={handleClear}
        className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
      >
        Clear / مسح
      </button>
    </form>
  );
}
