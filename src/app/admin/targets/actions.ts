'use server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { productionTarget } from '@/db/schema';
import { requireRole } from '@/lib/auth';

export async function upsertTarget(
  _prev: unknown,
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  await requireRole('ADMIN');

  const workCenterId = parseInt(formData.get('workCenterId') as string);
  const date = formData.get('date') as string;
  const targetQuantity = parseInt(formData.get('targetQuantity') as string);

  if (!workCenterId || !date || isNaN(targetQuantity))
    return { error: 'Invalid input / بيانات غير صالحة' };
  if (targetQuantity < 0)
    return { error: 'Target must be ≥ 0 / الهدف يجب أن يكون 0 أو أكثر' };

  try {
    const existing = await db
      .select({ id: productionTarget.id })
      .from(productionTarget)
      .where(and(
        eq(productionTarget.workCenterId, workCenterId),
        eq(productionTarget.date, date),
      ))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(productionTarget)
        .set({ targetQuantity })
        .where(eq(productionTarget.id, existing[0].id));
    } else {
      await db
        .insert(productionTarget)
        .values({ workCenterId, date, targetQuantity });
    }

    revalidatePath('/admin/targets');
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

export async function deleteTarget(
  _prev: unknown,
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  await requireRole('ADMIN');

  const id = parseInt(formData.get('targetId') as string);
  if (!id) return { error: 'Invalid target ID / معرف الهدف غير صالح' };

  try {
    await db.delete(productionTarget).where(eq(productionTarget.id, id));
    revalidatePath('/admin/targets');
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}
