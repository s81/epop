'use client';
import { CrudPage } from '@/components/admin/CrudPage';
import { ModelForm } from './form';
import type { model } from '@/db/schema';
import type { InferSelectModel } from 'drizzle-orm';
import type { deleteModel } from './actions';

type Model = InferSelectModel<typeof model>;

const COLUMNS = [
  { key: 'code' as const,   header: 'Code' },
  { key: 'nameAr' as const, header: 'Arabic Name', rtl: true },
  { key: 'nameEn' as const, header: 'English Name' },
];

export function ModelsClient({
  data,
  onDelete,
}: {
  data: Model[];
  onDelete: typeof deleteModel;
}) {
  return (
    <CrudPage
      title="Models"
      data={data}
      columns={COLUMNS}
      FormComponent={ModelForm}
      onDelete={onDelete}
    />
  );
}
