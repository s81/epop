'use client';
import { useActionState, useEffect } from 'react';
import { saveWorkCenter } from './actions';
import { FormField } from '@/components/admin/FormField';
import { SelectField } from '@/components/admin/SelectField';
import type { workCenter, department } from '@/db/schema';
import type { InferSelectModel } from 'drizzle-orm';

type WorkCenter = InferSelectModel<typeof workCenter>;
type Department = Pick<InferSelectModel<typeof department>, 'id' | 'nameEn' | 'code'>;

export function WorkCenterForm({
  item,
  onSuccess,
  departments = [],
}: {
  item?: WorkCenter;
  onSuccess: () => void;
  departments?: Department[];
}) {
  const [state, formAction, pending] = useActionState(saveWorkCenter, null);

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
        label="Department"
        name="departmentId"
        defaultValue={item?.departmentId}
        required
        options={departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.nameEn}` }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Capacity / Shift"
          name="capacityPerShift"
          defaultValue={item?.capacityPerShift ?? 1}
          type="number"
          step="0.5"
          min="0"
        />
        <FormField
          label="Buffer (min)"
          name="bufferMinutes"
          defaultValue={item?.bufferMinutes ?? 0}
          type="number"
          min="0"
        />
      </div>
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
