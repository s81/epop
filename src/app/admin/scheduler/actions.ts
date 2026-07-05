'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { clearSchedule, runScheduler } from '@/db/scheduler';
import { db } from '@/db/db';
import { workOrderOperation } from '@/db/schema';
import { requireRole } from '@/lib/auth';

export async function runScheduleAction(): Promise<{ scheduled: number; cleared: number; errors: string[] }> {
  await requireRole('DATA_ENTRY');
  const cleared = await clearSchedule();
  const result = await runScheduler();
  revalidatePath('/admin/scheduler');
  return { ...result, cleared };
}

export async function clearScheduleAction(): Promise<{ cleared: number }> {
  await requireRole('DATA_ENTRY');
  const cleared = await clearSchedule();
  revalidatePath('/admin/scheduler');
  return { cleared };
}

export async function rescheduleOperation(
  operationId: number,
  newStart: string,
  newEnd: string,
): Promise<{ success: boolean } | { error: string }> {
  try {
    await requireRole('DATA_ENTRY');

    const [op] = await db
      .select({ status: workOrderOperation.status })
      .from(workOrderOperation)
      .where(eq(workOrderOperation.id, operationId))
      .limit(1);

    if (!op) return { error: 'Operation not found' };
    if (op.status !== 'QUEUED') return { error: 'Only QUEUED operations can be rescheduled' };

    await db
      .update(workOrderOperation)
      .set({ scheduledStart: newStart, scheduledEnd: newEnd })
      .where(eq(workOrderOperation.id, operationId));

    revalidatePath('/admin/scheduler');
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
