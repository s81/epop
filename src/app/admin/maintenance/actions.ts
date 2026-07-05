'use server';
import { eq, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { maintenanceRequest, workCenter } from '@/db/schema';
import { requireRole } from '@/lib/auth';

export async function resolveMaintenanceAction(id: number): Promise<void> {
  await requireRole('DATA_ENTRY');
  await db
    .update(maintenanceRequest)
    .set({ status: 'RESOLVED', resolvedAt: new Date().toISOString() })
    .where(eq(maintenanceRequest.id, id));
  revalidatePath('/admin/maintenance');
}

export async function createMaintenanceRequest(
  _prev: unknown,
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  await requireRole('DATA_ENTRY');

  const workCenterId = parseInt(formData.get('workCenterId') as string);
  const category = formData.get('category') as string;
  const note = (formData.get('note') as string) ?? '';

  if (!workCenterId) return { error: 'Work center is required / مركز العمل مطلوب' };
  if (!category) return { error: 'Category is required / الفئة مطلوبة' };

  try {
    await db.insert(maintenanceRequest).values({
      workCenterId,
      category: category as any,
      note: note || null,
      reportedBy: 'admin',
    });
    revalidatePath('/admin/maintenance');
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}
