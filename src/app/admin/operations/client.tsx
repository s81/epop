'use client';
import { useActionState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { resetOperation } from './actions';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses / جميع الحالات' },
  { value: 'QUEUED', label: 'QUEUED' },
  { value: 'IN_PROGRESS', label: 'IN_PROGRESS' },
  { value: 'PAUSED', label: 'PAUSED' },
  { value: 'PENDING_QC', label: 'PENDING_QC' },
  { value: 'COMPLETED', label: 'COMPLETED' },
  { value: 'REJECTED', label: 'REJECTED' },
];

export function OperationsFilters({
  workCenters,
}: {
  workCenters: { code: string; nameAr: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get('status') ?? '';
  const wc = searchParams.get('wc') ?? '';
  const q = searchParams.get('q') ?? '';

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

  const hasFilters = status || wc || q;

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3 mb-4">
      <select
        name="status"
        defaultValue={status}
        className="bg-white border border-gray-300 text-gray-700 text-sm rounded px-3 py-2"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      <select
        name="wc"
        defaultValue={wc}
        className="bg-white border border-gray-300 text-gray-700 text-sm rounded px-3 py-2"
      >
        <option value="">All Work Centers / جميع المراكز</option>
        {workCenters.map((wc) => (
          <option key={wc.code} value={wc.code}>{wc.code} — {wc.nameAr}</option>
        ))}
      </select>

      <input
        name="q"
        type="text"
        defaultValue={q}
        placeholder="Order # / رقم الأمر"
        className="bg-white border border-gray-300 text-gray-700 text-sm rounded px-3 py-2 w-40"
      />

      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        Filter / تصفية
      </button>

      {hasFilters && (
        <button
          type="button"
          onClick={handleClear}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Clear / مسح
        </button>
      )}
    </form>
  );
}

export function OperationsActions({ operationId, status }: { operationId: number; status: string }) {
  const [state, action, pending] = useActionState(resetOperation, null);

  if (status === 'QUEUED') return null;

  return (
    <form action={action}>
      <input type="hidden" name="id" value={operationId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-amber-600 hover:text-amber-800 font-medium disabled:opacity-50"
      >
        {pending ? '…' : 'Reset / إعادة'}
      </button>
    </form>
  );
}