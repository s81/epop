'use client';
import { CrudPage } from '@/components/admin/CrudPage';
import { ColorForm } from './form';
import type { color, colorFamily } from '@/db/schema';
import type { InferSelectModel } from 'drizzle-orm';
import type { deleteColor } from './actions';

type Color = InferSelectModel<typeof color>;
type ColorFamily = Pick<InferSelectModel<typeof colorFamily>, 'id' | 'nameEn' | 'code'>;

const COLUMNS = [
  { key: 'code' as const,   header: 'Code' },
  { key: 'nameAr' as const, header: 'Arabic Name', rtl: true },
  { key: 'nameEn' as const, header: 'English Name' },
  { key: 'colorFamilyId' as const, header: 'Family ID' },
];

export function ColorsClient({
  data,
  colorFamilies,
  onDelete,
}: {
  data: Color[];
  colorFamilies: ColorFamily[];
  onDelete: typeof deleteColor;
}) {
  return (
    <CrudPage
      title="Colors"
      data={data}
      columns={COLUMNS}
      FormComponent={ColorForm}
      onDelete={onDelete}
      formProps={{ colorFamilies }}
    />
  );
}
