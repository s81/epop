'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { color } from '@/db/schema';

export async function saveColor(_prev: unknown, formData: FormData) {
  const id = formData.get('id');
  const code = (formData.get('code') as string).trim().toUpperCase();
  const nameAr = (formData.get('nameAr') as string).trim();
  const nameEn = (formData.get('nameEn') as string).trim();
  const colorFamilyId = Number(formData.get('colorFamilyId'));

  try {
    if (id) {
      await db
        .update(color)
        .set({ code, nameAr, nameEn, colorFamilyId })
        .where(eq(color.id, Number(id)));
    } else {
      await db.insert(color).values({ code, nameAr, nameEn, colorFamilyId });
    }
    revalidatePath('/admin/colors');
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg.includes('UNIQUE') ? `Code "${code}" already exists` : msg };
  }
}

export async function deleteColor(formData: FormData) {
  const id = Number(formData.get('id'));
  await db.delete(color).where(eq(color.id, id));
  revalidatePath('/admin/colors');
}
