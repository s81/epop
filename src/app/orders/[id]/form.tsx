'use client';
import { useActionState, useEffect } from 'react';
import { SelectField } from '@/components/admin/SelectField';
import { FormField } from '@/components/admin/FormField';
import type { addLine } from './actions';

type Model = { id: number; code: string; nameEn: string };
type Color = { id: number; code: string; nameEn: string };

export function LineForm({
  workOrderId,
  models,
  colors,
  onSuccess,
  onAddLine,
}: {
  workOrderId: number;
  models: Model[];
  colors: Color[];
  onSuccess: () => void;
  onAddLine: typeof addLine;
}) {
  const [state, formAction, pending] = useActionState(onAddLine, null);

  useEffect(() => {
    if (state && 'success' in state) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={formAction}>
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <SelectField
        label="Model / النموذج"
        name="modelId"
        required
        options={models.map((m) => ({ value: m.id, label: `${m.code} — ${m.nameEn}` }))}
      />
      <SelectField
        label="Color / اللون (optional)"
        name="colorId"
        options={colors.map((c) => ({ value: c.id, label: `${c.code} — ${c.nameEn}` }))}
      />
      <FormField
        label="Quantity / الكمية"
        name="quantity"
        type="number"
        defaultValue="1"
        min="1"
        required
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
          {pending ? 'Adding…' : 'Add Line / إضافة'}
        </button>
      </div>
    </form>
  );
}
