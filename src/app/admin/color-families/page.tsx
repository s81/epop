import { asc } from 'drizzle-orm';
import { db } from '@/db/db';
import { colorFamily } from '@/db/schema';
import { ColorFamiliesClient } from './client';
import { deleteColorFamily } from './actions';

export default async function ColorFamiliesPage() {
  const families = await db.select().from(colorFamily).orderBy(asc(colorFamily.code));
  return <ColorFamiliesClient data={families} onDelete={deleteColorFamily} />;
}
