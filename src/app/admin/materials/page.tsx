import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { material, materialCategory } from '@/db/schema';
import { MaterialsClient } from './client';
import { deleteMaterial } from './actions';

export default async function MaterialsPage() {
  const [materials, categories] = await Promise.all([
    db.select({
      id: material.id,
      code: material.code,
      nameAr: material.nameAr,
      nameEn: material.nameEn,
      unit: material.unit,
      categoryId: material.categoryId,
      categoryName: materialCategory.nameEn,
      createdAt: material.createdAt,
    }).from(material)
      .innerJoin(materialCategory, eq(materialCategory.id, material.categoryId))
      .orderBy(asc(material.code)),
    db.select({ id: materialCategory.id, code: materialCategory.code, nameEn: materialCategory.nameEn })
      .from(materialCategory)
      .orderBy(asc(materialCategory.code)),
  ]);
  return (
    <MaterialsClient
      data={materials}
      categories={categories}
      onDelete={deleteMaterial}
    />
  );
}
