'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { shiftCalendar } from '@/db/schema';
import { requireRole } from '@/lib/auth';

export async function upsertShift(
  _prev: unknown,
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  await requireRole('ADMIN');

  const date = (formData.get('date') as string) ?? '';
  const startTime = (formData.get('startTime') as string) ?? '';
  const endTime = (formData.get('endTime') as string) ?? '';
  const isWorkingDay = formData.get('isWorkingDay') === 'on';

  if (!date) return { error: 'Date is required / التاريخ مطلوب' };
  if (!startTime) return { error: 'Start time is required / وقت البدء مطلوب' };
  if (!endTime) return { error: 'End time is required / وقت الانتهاء مطلوب' };
  if (startTime >= endTime)
    return { error: 'Start time must be before end time / يجب أن يكون وقت البدء قبل وقت الانتهاء' };

  try {
    await db
      .insert(shiftCalendar)
      .values({ date, startTime, endTime, isWorkingDay })
      .onConflictDoUpdate({
        target: shiftCalendar.date,
        set: { startTime, endTime, isWorkingDay },
      });
    revalidatePath('/admin/shifts');
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

export async function deleteShift(formData: FormData): Promise<void> {
  await requireRole('ADMIN');
  const date = formData.get('date') as string;
  if (!date) throw new Error('Date is required');
  await db.delete(shiftCalendar).where(eq(shiftCalendar.date, date));
  revalidatePath('/admin/shifts');
}
