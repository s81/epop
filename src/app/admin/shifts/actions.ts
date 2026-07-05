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

export async function bulkCreateShifts(
  _prev: unknown,
  formData: FormData,
): Promise<{ success: true; count: number } | { error: string }> {
  await requireRole('ADMIN');

  const year = parseInt(formData.get('year') as string);
  const month = parseInt(formData.get('month') as string);
  const startTime = (formData.get('startTime') as string) ?? '08:00';
  const endTime = (formData.get('endTime') as string) ?? '16:00';
  const dayValues = formData.getAll('workingDays').map(Number);
  const daySet = dayValues.length > 0 ? new Set(dayValues) : new Set([1, 2, 3, 4, 5]); // default Mon-Fri

  if (!year || !month) return { error: 'Year and month are required' };
  if (month < 1 || month > 12) return { error: 'Invalid month' };
  const numDays = new Date(year, month, 0).getDate();
  const values: { date: string; startTime: string; endTime: string; isWorkingDay: boolean }[] = [];

  for (let d = 1; d <= numDays; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dow = new Date(dateStr + 'T00:00:00').getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const isWorking = daySet.has(dow);
    values.push({ date: dateStr, startTime, endTime, isWorkingDay: isWorking });
  }

  try {
    await db.insert(shiftCalendar).values(values).onConflictDoNothing({ target: shiftCalendar.date });
    revalidatePath('/admin/shifts');
    return { success: true, count: values.length };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}
