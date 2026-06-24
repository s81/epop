import { asc } from 'drizzle-orm';
import { db } from '@/db/db';
import { department } from '@/db/schema';
import { DepartmentsClient } from './client';
import { deleteDepartment } from './actions';

export default async function DepartmentsPage() {
  const departments = await db.select().from(department).orderBy(asc(department.code));
  return <DepartmentsClient data={departments} onDelete={deleteDepartment} />;
}
