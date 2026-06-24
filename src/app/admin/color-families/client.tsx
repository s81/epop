'use client';
import { CrudPage } from '@/components/admin/CrudPage';
import { ColorFamilyForm } from './form';
import type { colorFamily } from '@/db/schema';
import type { InferSelectModel } from 'drizzle-orm';
import type { deleteColorFamily } from './actions';

type ColorFamily = InferSelectModel<typeof colorFamily>;

const COLUMNS = [
  { key: 'code' as const,   header: 'Code' },
  { key: 'nameAr' as const, header: 'Arabic Name', rtl: true },
  { key: 'nameEn' as const, header: 'English Name' },
];

export function ColorFamiliesClient({
  data,
  onDelete,
}: {
  data: ColorFamily[];
  onDelete: typeof deleteColorFamily;
}) {
  return (
    <CrudPage
      title="Color Families"
      data={data}
      columns={COLUMNS}
      FormComponent={ColorFamilyForm}
      onDelete={onDelete}
    />
  );
}
