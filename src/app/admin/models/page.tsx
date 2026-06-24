import { asc } from 'drizzle-orm';
import { db } from '@/db/db';
import { model } from '@/db/schema';
import { ModelsClient } from './client';
import { deleteModel } from './actions';

export default async function ModelsPage() {
  const models = await db.select().from(model).orderBy(asc(model.code));
  return <ModelsClient data={models} onDelete={deleteModel} />;
}
