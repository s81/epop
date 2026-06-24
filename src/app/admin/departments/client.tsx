'use client';
import { CrudPage } from '@/components/admin/CrudPage';
import { DepartmentForm } from './form';
import type { department } from '@/db/schema';
import type { InferSelectModel } from 'drizzle-orm';
import type { deleteDepartment } from './actions';

type Department = InferSelectModel<typeof department>;

const COLUMNS = [
  { key: 'code' as const,   header: 'Code' },
  { key: 'nameAr' as const, header: 'Arabic Name', rtl: true },
  { key: 'nameEn' as const, header: 'English Name' },
];

export function DepartmentsClient({
  data,
  onDelete,
}: {
  data: Department[];
  onDelete: typeof deleteDepartment;
}) {
  return (
    <CrudPage
      title="Departments"
      data={data}
      columns={COLUMNS}
      FormComponent={DepartmentForm}
      onDelete={onDelete}
    />
  );
}
