'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { colorFamily } from '@/db/schema';

export async function saveColorFamily(_prev: unknown, formData: FormData) {
  const id = formData.get('id');
  const code = (formData.get('code') as string).trim().toUpperCase();
  const nameAr = (formData.get('nameAr') as string).trim();
  const nameEn = (formData.get('nameEn') as string).trim();

  try {
    if (id) {
      await db.update(colorFamily).set({ code, nameAr, nameEn }).where(eq(colorFamily.id, Number(id)));
    } else {
      await db.insert(colorFamily).values({ code, nameAr, nameEn });
    }
    revalidatePath('/admin/color-families');
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg.includes('UNIQUE') ? `Code "${code}" already exists` : msg };
  }
}

export async function deleteColorFamily(formData: FormData) {
  const id = Number(formData.get('id'));
  await db.delete(colorFamily).where(eq(colorFamily.id, id));
  revalidatePath('/admin/color-families');
}
