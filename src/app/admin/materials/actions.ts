'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { material } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { dbErrorMessage } from '@/lib/db-errors';

export async function saveMaterial(_prev: unknown, formData: FormData) {
  const id = formData.get('id');
  const code = (formData.get('code') as string).trim().toUpperCase();
  const nameAr = (formData.get('nameAr') as string).trim();
  const nameEn = (formData.get('nameEn') as string).trim();
  const unit = (formData.get('unit') as string).trim();
  const categoryId = Number(formData.get('categoryId'));

  try {
    await requireRole('DATA_ENTRY');
    if (id) {
      await db
        .update(material)
        .set({ code, nameAr, nameEn, unit, categoryId })
        .where(eq(material.id, Number(id)));
    } else {
      await db.insert(material).values({ code, nameAr, nameEn, unit, categoryId });
    }
    revalidatePath('/admin/materials');
    return { success: true };
  } catch (e: unknown) {
    const msg = dbErrorMessage(e);
    return { error: msg.includes('UNIQUE') ? `Code "${code}" already exists` : msg };
  }
}

export async function deleteMaterial(formData: FormData): Promise<void | { error: string }> {
  await requireRole('DATA_ENTRY');
  const id = Number(formData.get('id'));
  try {
    await db.delete(material).where(eq(material.id, id));
  } catch (e: unknown) {
    const msg = dbErrorMessage(e);
    if (msg.includes('FOREIGN KEY')) {
      return { error: 'Cannot delete: this material has stock transactions / لا يمكن الحذف: لهذه المادة حركات مخزون' };
    }
    return { error: msg };
  }
  revalidatePath('/admin/materials');
}
