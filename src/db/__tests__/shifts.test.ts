import { describe, it, expect } from 'vitest';
import { ShiftCalendar } from '../shifts';

function localDate(y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(y, m - 1, d, h, min, 0, 0);
}

const ENTRIES = [
  { date: '2026-07-06', startTime: '08:00', endTime: '16:00', isWorkingDay: true },
  { date: '2026-07-07', startTime: '08:00', endTime: '16:00', isWorkingDay: true },
  { date: '2026-07-08', startTime: '08:00', endTime: '16:00', isWorkingDay: true },
  { date: '2026-07-09', startTime: '08:00', endTime: '16:00', isWorkingDay: true },
  { date: '2026-07-10', startTime: '08:00', endTime: '16:00', isWorkingDay: false },
  { date: '2026-07-11', startTime: '08:00', endTime: '16:00', isWorkingDay: false },
  { date: '2026-07-12', startTime: '08:00', endTime: '16:00', isWorkingDay: true },
  { date: '2026-07-13', startTime: '08:00', endTime: '16:00', isWorkingDay: true },
];

const sc = new ShiftCalendar(ENTRIES);

describe('constructor', () => {
  it('stores working days in the map', () => {
    for (const d of ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-12', '2026-07-13']) {
      const parts = d.split('-').map(Number);
      expect(sc.getShiftForDate(localDate(parts[0], parts[1], parts[2]))).not.toBeNull();
    }
  });

  it('skips non-working days', () => {
    expect(sc.getShiftForDate(localDate(2026, 7, 10))).toBeNull();
    expect(sc.getShiftForDate(localDate(2026, 7, 11))).toBeNull();
  });
});

describe('getShiftForDate', () => {
  it('returns shift with correct start/end for a working day', () => {
    const shift = sc.getShiftForDate(localDate(2026, 7, 6));
    expect(shift).not.toBeNull();
    expect(shift!.start.getHours()).toBe(8);
    expect(shift!.end.getHours()).toBe(16);
  });

  it('returns null for non-working day', () => {
    expect(sc.getShiftForDate(localDate(2026, 7, 10))).toBeNull();
  });
});

describe('getNextSlotStart', () => {
  it('returns same time if within working hours', () => {
    const at = localDate(2026, 7, 6, 10, 30);
    expect(sc.getNextSlotStart(at).getTime()).toBe(at.getTime());
  });

  it('returns shift start if before hours', () => {
    const next = sc.getNextSlotStart(localDate(2026, 7, 6, 5, 0));
    expect(next.getHours()).toBe(8);
    expect(next.getMinutes()).toBe(0);
  });

  it('returns next working day if after shift end', () => {
    // Mon 17:00 → Tue 08:00
    const next = sc.getNextSlotStart(localDate(2026, 7, 6, 17, 0));
    expect(next.getDate()).toBe(7);
    expect(next.getHours()).toBe(8);
  });

  it('skips Friday and Saturday weekend', () => {
    // Thu 17:00 → Sun 08:00 (skips Fri & Sat)
    const next = sc.getNextSlotStart(localDate(2026, 7, 9, 17, 0));
    expect(next.getDate()).toBe(12);
    expect(next.getHours()).toBe(8);
  });

  it('on Saturday returns Sunday 08:00', () => {
    const next = sc.getNextSlotStart(localDate(2026, 7, 11, 10, 0));
    expect(next.getDate()).toBe(12);
    expect(next.getHours()).toBe(8);
  });
});

describe('addDuration', () => {
  it('stays within same shift when duration fits', () => {
    const end = sc.addDuration(localDate(2026, 7, 6, 10, 0), 60);
    expect(end.getHours()).toBe(11);
    expect(end.getMinutes()).toBe(0);
  });

  it('spills to next day when duration exceeds shift remaining', () => {
    // Mon 15:30 + 60min → 30min on Mon + 30min on Tue → Tue 08:30
    const end = sc.addDuration(localDate(2026, 7, 6, 15, 30), 60);
    expect(end.getDate()).toBe(7);
    expect(end.getHours()).toBe(8);
    expect(end.getMinutes()).toBe(30);
  });

  it('spills across weekend', () => {
    // Thu 15:00 + 120min → 60min on Thu + 60min on Sun → Sun 09:00
    const end = sc.addDuration(localDate(2026, 7, 9, 15, 0), 120);
    expect(end.getDate()).toBe(12);
    expect(end.getHours()).toBe(9);
  });

  it('handles duration exactly filling remaining shift time', () => {
    // Mon 14:00 + 120min → exactly 16:00
    const end = sc.addDuration(localDate(2026, 7, 6, 14, 0), 120);
    expect(end.getHours()).toBe(16);
    expect(end.getMinutes()).toBe(0);
  });

  it('spills to next day when starting past shift end', () => {
    // Mon 16:00 + 30min → should move to Tue 08:30
    const end = sc.addDuration(localDate(2026, 7, 6, 16, 0), 30);
    expect(end.getDate()).toBe(7);
    expect(end.getHours()).toBe(8);
    expect(end.getMinutes()).toBe(30);
  });

  it('spans multiple days for long durations', () => {
    // Mon 08:00 + 900min (15h) → 8h Mon + 7h Tue → Tue 15:00
    const end = sc.addDuration(localDate(2026, 7, 6, 8, 0), 900);
    expect(end.getDate()).toBe(7);
    expect(end.getHours()).toBe(15);
    expect(end.getMinutes()).toBe(0);
  });
});
