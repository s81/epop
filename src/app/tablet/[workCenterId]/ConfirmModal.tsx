'use client';
import { useState } from 'react';

type Category = { value: string; labelAr: string; labelEn: string };

export function ConfirmModal({
  title,
  categories,
  noteField = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  categories: Category[];
  noteField?: boolean;
  onConfirm: (category: string, note?: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm" dir="rtl">
        <h2 className="text-xl font-bold mb-5 text-center text-white">{title}</h2>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {categories.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setSelected(cat.value)}
              className={`min-h-[68px] rounded-xl font-semibold text-sm transition-colors ${
                selected === cat.value
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
            >
              <div className="text-base">{cat.labelAr}</div>
              <div className="text-xs text-gray-300 font-normal mt-0.5">{cat.labelEn}</div>
            </button>
          ))}
        </div>

        {noteField && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ملاحظات / Notes (اختياري / optional)"
            rows={2}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm mb-4 text-white outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
        )}

        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-h-[52px] rounded-xl bg-gray-700 text-gray-200 font-semibold hover:bg-gray-600 transition-colors"
          >
            إلغاء / Cancel
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && onConfirm(selected, note.trim() || undefined)}
            className="flex-1 min-h-[52px] rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            تأكيد / Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
