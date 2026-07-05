import { shiftCalendar } from './schema';
import { db } from './db';

type ShiftRow = {
  date: string;
  startTime: string;
  endTime: string;
  isWorkingDay: boolean;
};

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Loads shift calendar entries from DB and provides shift-aware time
 * calculation for the scheduler using local-date semantics.
 */
export class ShiftCalendar {
  private shifts: Map<string, { start: string; end: string }>;

  constructor(entries: ShiftRow[]) {
    this.shifts = new Map();
    for (const e of entries) {
      if (e.isWorkingDay) {
        this.shifts.set(e.date, { start: e.startTime, end: e.endTime });
      }
    }
  }

  static async load(dbInstance: typeof db = db): Promise<ShiftCalendar> {
    const rows = await dbInstance
      .select({
        date: shiftCalendar.date,
        startTime: shiftCalendar.startTime,
        endTime: shiftCalendar.endTime,
        isWorkingDay: shiftCalendar.isWorkingDay,
      })
      .from(shiftCalendar)
      .orderBy(shiftCalendar.date);
    return new ShiftCalendar(rows);
  }

  /** Look up shift for a date using local timezone date. */
  getShiftForDate(date: Date): { start: Date; end: Date } | null {
    const key = localDateKey(date);
    const entry = this.shifts.get(key);
    if (!entry) return null;
    const start = new Date(`${key}T${entry.start}:00`);
    const end = new Date(`${key}T${entry.end}:00`);
    return { start, end };
  }

  /** Returns the earliest working time >= `after` (local time). */
  getNextSlotStart(after: Date): Date {
    const shift = this.getShiftForDate(after);
    if (shift) {
      const start = after > shift.start ? after : shift.start;
      if (start < shift.end) return start;
    }
    const cursor = new Date(after);
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const s = this.getShiftForDate(cursor);
      if (s) return s.start;
      cursor.setDate(cursor.getDate() + 1);
    }
    return after;
  }

  /** Adds `durationMinutes` respecting shift boundaries, spilling across days. */
  addDuration(from: Date, durationMinutes: number): Date {
    let remaining = durationMinutes;
    let current = from;

    while (remaining > 0) {
      const shift = this.getShiftForDate(current);
      if (!shift || current.getTime() >= shift.end.getTime()) {
        current = this.getNextSlotStart(current);
        continue;
      }
      const available = (shift.end.getTime() - current.getTime()) / 60000;
      if (available >= remaining) {
        return new Date(current.getTime() + remaining * 60000);
      }
      remaining -= available;
      current = new Date(shift.end.getTime() + 1000);
    }

    return current;
  }
}
