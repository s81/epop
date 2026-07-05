'use client';
import { CrudPage } from '@/components/admin/CrudPage';
import { CategoryForm } from './form';
import type { materialCategory } from '@/db/schema';
import type { InferSelectModel } from 'drizzle-orm';
import type { deleteCategory } from './actions';

type Category = InferSelectModel<typeof materialCategory>;

const COLUMNS = [
  { key: 'code' as const,   header: 'Code' },
  { key: 'nameAr' as const, header: 'Arabic Name', rtl: true },
  { key: 'nameEn' as const, header: 'English Name' },
];

export function CategoriesClient({
  data,
  onDelete,
}: {
  data: Category[];
  onDelete: typeof deleteCategory;
}) {
  return (
    <CrudPage
      title="Material Categories / فئات المواد"
      data={data}
      columns={COLUMNS}
      FormComponent={CategoryForm}
      onDelete={onDelete}
    />
  );
}
