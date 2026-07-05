import { asc, like } from 'drizzle-orm';
import { db } from '@/db/db';
import { shiftCalendar } from '@/db/schema';
import { ShiftsClient } from './client';
import { deleteShift } from './actions';

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default async function ShiftsPage(props: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await props.searchParams;
  const monthStr = month ?? currentMonth();

  const shifts = await db
    .select()
    .from(shiftCalendar)
    .where(like(shiftCalendar.date, `${monthStr}-%`))
    .orderBy(asc(shiftCalendar.date));

  return (
    <ShiftsClient
      data={shifts}
      month={monthStr}
      onDelete={deleteShift}
    />
  );
}
