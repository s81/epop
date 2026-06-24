import { asc } from 'drizzle-orm';
import { db } from '@/db/db';
import { color, colorFamily } from '@/db/schema';
import { ColorsClient } from './client';
import { deleteColor } from './actions';

export default async function ColorsPage() {
  const [colors, colorFamilies] = await Promise.all([
    db.select().from(color).orderBy(asc(color.code)),
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
