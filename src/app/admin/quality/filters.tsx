'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { QualityDefectCategory } from '@/db/schema';

const CATEGORIES: { value: QualityDefectCategory; label: string }[] = [
  { value: 'DIMENSIONAL', label: 'أبعاد / Dimensional' },
  { value: 'SURFACE', label: 'سطح / Surface + Paint' },
  { value: 'ASSEMBLY', label: 'تجميع / Assembly' },
  { value: 'OTHER', label: 'أخرى / Other' },
];

export function QualityFilters({
  workCenters,
}: {
  workCenters: { code: string; nameAr: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const category = searchParams.get('category') || '';
  const wc = searchParams.get('wc') || '';

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/admin/quality?${params.toString()}`);
  }

  function clearFilters() {
    router.push('/admin/quality');
  }

  const hasFilters = category || wc;

  return (
    <div className="flex items-center gap-3 mb-4">
      <select
        value={category}
        onChange={(e) => setParam('category', e.target.value)}
        className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-1.5"
      >
        <option value="">All Categories / جميع الفئات</option>
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <select
        value={wc}
        onChange={(e) => setParam('wc', e.target.value)}
        className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-1.5"
      >
        <option value="">All Work Centers / جميع المراكز</option>
        {workCenters.map((wc) => (
          <option key={wc.code} value={wc.code}>
            {wc.code} — {wc.nameAr}
          </option>
        ))}
      </select>

      {hasFilters && (
        <button
          onClick={clearFilters}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Clear / مسح
        </button>
      )}
    </div>
  );
}
