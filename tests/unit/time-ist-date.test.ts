import { describe, expect, it } from 'vitest';

import { formatIst, formatIstDate } from '@/lib/time';

/**
 * STORY-09.05 AC-4 (SCR-22, "Your overdue tasks, 05 Nov 2026"): the day alone, in IST, written as `formatIst` writes it, whatever the time zone of the machine. Every date is invented.
 */

describe('formatIstDate writes the calendar day in IST', () => {
  it('writes the day, the short month and the year, as formatIst does', () => {
    expect(formatIstDate(new Date('2026-11-05T05:30:00.000Z'))).toBe('05 Nov 2026');
  });

  it('is the date part of formatIst for every month name', () => {
    for (let month = 0; month < 12; month += 1) {
      const instant = new Date(Date.UTC(2026, month, 9, 6, 0));
      const text = formatIstDate(instant);
      expect(text, `month ${month}`).toBe(text.trim());
      expect(formatIst(instant).startsWith(`${text},`), `month ${month}`).toBe(true);
    }
  });

  it('crosses midnight in IST, not in UTC (edge case)', () => {
    expect(formatIstDate(new Date('2026-11-05T18:29:59.999Z'))).toBe('05 Nov 2026');
    expect(formatIstDate(new Date('2026-11-05T18:30:00.000Z'))).toBe('06 Nov 2026');
  });

  it('refuses an invalid date: that is a mistake in the code, not something to show', () => {
    expect(() => formatIstDate(new Date('not a date'))).toThrow(RangeError);
  });
});
