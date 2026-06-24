'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { workCenter } from '@/db/schema';

export async function saveWorkCenter(_prev: unknown, formData: FormData) {
  const id = formData.get('id');
  const code = (formData.get('code') as string).trim().toUpperCase();
  const nameAr = (formData.get('nameAr') as string).trim();
  const nameEn = (formData.get('nameEn') as string).trim();
  const departmentId = Number(formData.get('departmentId'));
  const capacityPerShift = parseFloat(formData.get('capacityPerShift') as string) || 1;
  const bufferMinutes = parseInt(formData.get('bufferMinutes') as string) || 0;

  try {
    if (id) {
      await db
        .update(workCenter)
        .set({ code, nameAr, nameEn, departmentId, capacityPerShift, bufferMinutes })
        .where(eq(workCenter.id, Number(id)));
    } else {
      await db.insert(workCenter).values({ code, nameAr, nameEn, departmentId, capacityPerShift, bufferMinutes });
    }
    revalidatePath('/admin/work-centers');
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg.includes('UNIQUE') ? `Code "${code}" already exists` : msg };
  }
}

export async function deleteWorkCenter(formData: FormData) {
  const id = Number(formData.get('id'));
  await db.delete(workCenter).where(eq(workCenter.id, id));
  revalidatePath('/admin/work-centers');
}
