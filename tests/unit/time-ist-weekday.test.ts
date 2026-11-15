import { describe, expect, it } from 'vitest';

import { formatIstWithWeekday } from '@/lib/time';

/**
 * STORY-02.09 AC-1: the Settings page writes the last good backup with its weekday, "Sunday 01 Nov 2026, 02:00 IST" (UX spec SCR-15). The weekday is the one in IST, whatever the time
 * zone of the machine, and the rest is `formatIst`. Every date is invented.
 */

describe('AC-1: formatIstWithWeekday writes the weekday in IST before the usual time', () => {
  it('writes "Sunday 01 Nov 2026, 02:00 IST" for the weekly backup time of the spec', () => {
    expect(formatIstWithWeekday(new Date('2026-10-31T20:30:00.000Z'))).toBe('Sunday 01 Nov 2026, 02:00 IST');
  });

  it('takes the weekday from the IST day, not the UTC day: 23:00 UTC on a Saturday is already Sunday in India', () => {
    expect(formatIstWithWeekday(new Date('2026-10-31T23:00:00.000Z'))).toBe('Sunday 01 Nov 2026, 04:30 IST');
    expect(formatIstWithWeekday(new Date('2026-10-31T18:29:00.000Z'))).toBe('Saturday 31 Oct 2026, 23:59 IST');
  });

  it('names every day of the week in full', () => {
    const days = Array.from({ length: 7 }, (_, index) => formatIstWithWeekday(new Date(Date.UTC(2026, 10, 2 + index, 6, 30))).split(' ')[0]);
    expect(days).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  });

  it('refuses an invalid date, as formatIst does', () => {
    expect(() => formatIstWithWeekday(new Date('not a date'))).toThrow(RangeError);
  });
});
