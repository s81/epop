'use client';
import { CrudPage } from '@/components/admin/CrudPage';
import { WorkCenterForm } from './form';
import type { workCenter, department } from '@/db/schema';
import type { InferSelectModel } from 'drizzle-orm';
import type { deleteWorkCenter } from './actions';

type WorkCenter = InferSelectModel<typeof workCenter>;
type Department = Pick<InferSelectModel<typeof department>, 'id' | 'nameEn' | 'code'>;

const COLUMNS = [
  { key: 'code' as const,   header: 'Code' },
  { key: 'nameAr' as const, header: 'Arabic Name', rtl: true },
  { key: 'nameEn' as const, header: 'English Name' },
  { key: 'capacityPerShift' as const, header: 'Capacity / Shift' },
  { key: 'bufferMinutes' as const,    header: 'Buffer (min)' },
];

export function WorkCentersClient({
  data,
  departments,
  onDelete,
}: {
  data: WorkCenter[];
  departments: Department[];
  onDelete: typeof deleteWorkCenter;
}) {
  return (
    <CrudPage
      title="Work Centers"
      data={data}
      columns={COLUMNS}
      FormComponent={WorkCenterForm}
      onDelete={onDelete}
      formProps={{ departments }}
    />
  );
}
