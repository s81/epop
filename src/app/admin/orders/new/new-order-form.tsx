'use client';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createWorkOrder } from '../actions';
import { SelectField } from '@/components/admin/SelectField';
import { FormField } from '@/components/admin/FormField';

export function NewOrderForm({
  models,
}: {
  models: { id: number; code: string; nameAr: string; nameEn: string }[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createWorkOrder, null);

  useEffect(() => {
    if (state && 'success' in state) {
      router.push('/admin/orders');
    }
  }, [state, router]);

  return (
    <form action={formAction}>
      <SelectField
        label="Model / الموديل"
        name="modelId"
        required
        options={models.map((m) => ({
          value: m.id,
          label: `${m.code} — ${m.nameEn} / ${m.nameAr}`,
        }))}
      />
      <FormField
        label="Quantity / الكمية"
        name="quantity"
        type="number"
        min="1"
        required
      />
      {state && 'error' in state && (
        <p className="text-red-500 text-sm mb-3">{state.error}</p>
      )}
      <div className="flex justify-end pt-2 gap-3">
        <button
          type="button"
          onClick={() => router.push('/admin/orders')}
          className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          Cancel / إلغاء
        </button>
        <button
          type="submit"
          disabled={pending}
          className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Creating… / جاري الإنشاء…' : 'Create / إنشاء'}
        </button>
      </div>
    </form>
  );
}
