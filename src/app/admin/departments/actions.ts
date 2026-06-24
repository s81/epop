'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { department } from '@/db/schema';

export async function saveDepartment(_prev: unknown, formData: FormData) {
  const id = formData.get('id');
  const code = (formData.get('code') as string).trim().toUpperCase();
  const nameAr = (formData.get('nameAr') as string).trim();
  const nameEn = (formData.get('nameEn') as string).trim();

  try {
    if (id) {
      await db.update(department).set({ code, nameAr, nameEn }).where(eq(department.id, Number(id)));
    } else {
      await db.insert(department).values({ code, nameAr, nameEn });
    }
    revalidatePath('/admin/departments');
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg.includes('UNIQUE') ? `Code "${code}" already exists` : msg };
  }
}

export async function deleteDepartment(formData: FormData) {
  const id = Number(formData.get('id'));
  await db.delete(department).where(eq(department.id, id));
  revalidatePath('/admin/departments');
}
