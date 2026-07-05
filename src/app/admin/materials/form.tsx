'use client';
import { useActionState, useEffect } from 'react';
import { saveMaterial } from './actions';
import { FormField } from '@/components/admin/FormField';
import { SelectField } from '@/components/admin/SelectField';
import type { material, materialCategory } from '@/db/schema';
import type { InferSelectModel } from 'drizzle-orm';

type Material = InferSelectModel<typeof material>;
type Category = Pick<InferSelectModel<typeof materialCategory>, 'id' | 'code' | 'nameEn'>;

const UNITS = ['pcs', 'm²', 'm', 'kg', 'sheet', 'roll', 'box', 'liter'];

export function MaterialForm({
  item,
  onSuccess,
  categories = [],
}: {
  item?: Material;
  onSuccess: () => void;
  categories?: Category[];
}) {
  const [state, formAction, pending] = useActionState(saveMaterial, null);

  useEffect(() => {
    if (state && 'success' in state) onSuccess();
  }, [state]);

  return (
    <form action={formAction}>
      {item && <input type="hidden" name="id" value={item.id} />}
      <FormField label="Code" name="code" defaultValue={item?.code} required />
      <FormField label="Arabic Name" name="nameAr" defaultValue={item?.nameAr} required dir="rtl" />
      <FormField label="English Name" name="nameEn" defaultValue={item?.nameEn} required />
      <SelectField
        label="Unit / الوحدة"
        name="unit"
        defaultValue={item?.unit ?? ''}
        required
        options={UNITS.map((u) => ({ value: u, label: u }))}
      />
      <SelectField
        label="Category / الفئة"
        name="categoryId"
        defaultValue={item?.categoryId}
        required
        options={categories.map((c) => ({ value: c.id, label: `${c.code} — ${c.nameEn}` }))}
      />
      {state && 'error' in state && (
        <p className="text-red-500 text-sm mb-3">{state.error}</p>
      )}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
