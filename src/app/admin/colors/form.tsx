'use client';
import { useActionState, useEffect } from 'react';
import { saveColor } from './actions';
import { FormField } from '@/components/admin/FormField';
import { SelectField } from '@/components/admin/SelectField';
import type { color, colorFamily } from '@/db/schema';
import type { InferSelectModel } from 'drizzle-orm';

type Color = InferSelectModel<typeof color>;
type ColorFamily = Pick<InferSelectModel<typeof colorFamily>, 'id' | 'nameEn' | 'code'>;

export function ColorForm({
  item,
  onSuccess,
  colorFamilies = [],
}: {
  item?: Color;
  onSuccess: () => void;
  colorFamilies?: ColorFamily[];
}) {
  const [state, formAction, pending] = useActionState(saveColor, null);

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
        label="Color Family"
        name="colorFamilyId"
        defaultValue={item?.colorFamilyId}
        required
        options={colorFamilies.map((f) => ({ value: f.id, label: `${f.code} — ${f.nameEn}` }))}
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
