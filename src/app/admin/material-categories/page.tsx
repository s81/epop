import { asc } from 'drizzle-orm';
import { db } from '@/db/db';
import { materialCategory } from '@/db/schema';
import { CategoriesClient } from './client';
import { deleteCategory } from './actions';

export default async function CategoriesPage() {
  const categories = await db
    .select()
    .from(materialCategory)
    .orderBy(asc(materialCategory.code));
  return (
    <CategoriesClient
      data={categories}
      onDelete={deleteCategory}
    />
  );
}
