import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { color, colorFamily } from '@/db/schema';
import { ColorsClient } from './client';
import { deleteColor } from './actions';

export default async function ColorsPage() {
  const [colors, colorFamilies] = await Promise.all([
    db.select({
      id: color.id,
      code: color.code,
      nameAr: color.nameAr,
      nameEn: color.nameEn,
      colorFamilyId: color.colorFamilyId,
      colorFamilyName: colorFamily.nameEn,
      createdAt: color.createdAt,
    }).from(color)
      .innerJoin(colorFamily, eq(colorFamily.id, color.colorFamilyId))
      .orderBy(asc(color.code)),
    db.select({ id: colorFamily.id, code: colorFamily.code, nameEn: colorFamily.nameEn })
      .from(colorFamily)
      .orderBy(asc(colorFamily.code)),
  ]);
  return (
    <ColorsClient
      data={colors}
      colorFamilies={colorFamilies}
      onDelete={deleteColor}
    />
  );
}
