'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { workOrderOperation } from '@/db/schema';
import { requireRole } from '@/lib/auth';

export async function resetOperation(
  _prev: unknown,
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  await requireRole('DATA_ENTRY');

  const id = Number(formData.get('id'));
  if (!id) return { error: 'Invalid operation ID' };

  const [op] = await db
    .select({ status: workOrderOperation.status })
    .from(workOrderOperation)
    .where(eq(workOrderOperation.id, id));

  if (!op) return { error: 'Operation not found' };
  if (op.status === 'QUEUED') return { error: 'Operation is already QUEUED' };

  await db
    .update(workOrderOperation)
    .set({
      status: 'QUEUED',
      scheduledStart: null,
      scheduledEnd: null,
      startedAt: null,
      pausedAt: null,
      finishedAt: null,
      completedAt: null,
      rejectedAt: null,
    })
    .where(eq(workOrderOperation.id, id));

  revalidatePath('/admin/operations');
  return { success: true };
}