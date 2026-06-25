'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { model } from '@/db/schema';
import { requireRole } from '@/lib/auth';

export async function saveModel(_prev: unknown, formData: FormData) {
  const id = formData.get('id');
  const code = (formData.get('code') as string).trim().toUpperCase();
  const nameAr = (formData.get('nameAr') as string).trim();
  const nameEn = (formData.get('nameEn') as string).trim();

  try {
    await requireRole('DATA_ENTRY');
    if (id) {
      await db.update(model).set({ code, nameAr, nameEn }).where(eq(model.id, Number(id)));
    } else {
      await db.insert(model).values({ code, nameAr, nameEn });
    }
    revalidatePath('/admin/models');
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg.includes('UNIQUE') ? `Code "${code}" already exists` : msg };
  }
}

export async function deleteModel(formData: FormData) {
  await requireRole('DATA_ENTRY');
  const id = Number(formData.get('id'));
  await db.delete(model).where(eq(model.id, id));
  revalidatePath('/admin/models');
}
