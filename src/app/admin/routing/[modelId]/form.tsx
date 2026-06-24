'use client';
import { useActionState, useEffect } from 'react';
import { saveStep } from './actions';
import { SelectField } from '@/components/admin/SelectField';
import { FormField } from '@/components/admin/FormField';

type Step = {
  id: number;
  sequence: number;
  workCenterId: number;
  manTimeMinutes: number;
  machineTimeMinutes: number;
  setupTimeMinutes: number;
  mco: string | null;
};

type WorkCenter = { id: number; code: string; nameEn: string };

export function StepForm({
  modelId,
  step,
  workCenters,
  onSuccess,
}: {
  modelId: number;
  step?: Step;
  workCenters: WorkCenter[];
  onSuccess: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveStep, null);

  useEffect(() => {
    if (state && 'success' in state) onSuccess();
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="modelId" value={modelId} />
      {step && <input type="hidden" name="id" value={step.id} />}

      <SelectField
        label="Work Center"
        name="workCenterId"
        defaultValue={step?.workCenterId}
        required
        options={workCenters.map((wc) => ({ value: wc.id, label: `${wc.code} — ${wc.nameEn}` }))}
      />

      <div className="grid grid-cols-3 gap-3">
        <FormField
          label="Man (min)"
          name="manTimeMinutes"
          defaultValue={step?.manTimeMinutes ?? 0}
          type="number"
          step="0.5"
          min="0"
        />
        <FormField
          label="Machine (min)"
          name="machineTimeMinutes"
          defaultValue={step?.machineTimeMinutes ?? 0}
          type="number"
          step="0.5"
          min="0"
        />
        <FormField
          label="Setup (min)"
          name="setupTimeMinutes"
          defaultValue={step?.setupTimeMinutes ?? 0}
          type="number"
          step="0.5"
          min="0"
        />
      </div>

      <FormField label="MCO (optional)" name="mco" defaultValue={step?.mco ?? ''} />

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
