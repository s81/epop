'use client';
import { CrudPage } from '@/components/admin/CrudPage';
import { MaterialForm } from './form';
import type { material, materialCategory } from '@/db/schema';
import type { InferSelectModel } from 'drizzle-orm';
import type { deleteMaterial } from './actions';

type Material = InferSelectModel<typeof material> & { categoryName: string };
type Category = Pick<InferSelectModel<typeof materialCategory>, 'id' | 'code' | 'nameEn'>;

const COLUMNS = [
  { key: 'code' as const,       header: 'Code' },
  { key: 'nameAr' as const,     header: 'Arabic Name', rtl: true },
  { key: 'nameEn' as const,     header: 'English Name' },
  { key: 'unit' as const,       header: 'Unit / الوحدة' },
  { key: 'categoryName' as const, header: 'Category / الفئة' },
];

export function MaterialsClient({
  data,
  categories,
  onDelete,
}: {
  data: Material[];
  categories: Category[];
  onDelete: typeof deleteMaterial;
}) {
  return (
    <CrudPage
      title="Materials / المواد"
      data={data}
      columns={COLUMNS}
      FormComponent={MaterialForm}
      onDelete={onDelete}
      formProps={{ categories }}
    />
  );
}
