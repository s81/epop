import { asc } from 'drizzle-orm';
import { db } from '@/db/db';
import { workCenter, department } from '@/db/schema';
import { WorkCentersClient } from './client';
import { deleteWorkCenter } from './actions';

export default async function WorkCentersPage() {
  const [workCenters, departments] = await Promise.all([
    db.select().from(workCenter).orderBy(asc(workCenter.code)),
    db.select({ id: department.id, code: department.code, nameEn: department.nameEn })
      .from(department)
      .orderBy(asc(department.code)),
  ]);
  return (
    <WorkCentersClient
      data={workCenters}
      departments={departments}
      onDelete={deleteWorkCenter}
    />
  );
}
