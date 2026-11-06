import { describe, expect, it } from 'vitest';

import { formatIst, isIsoDate, startOfIstDay, startOfNextIstDay } from '@/lib/time';

/**
 * STORY-01.07 T4 (AC-6): the one place a time reaches the screen. UTC in, "06 Nov 2026, 17:00 IST" out, whatever the time zone of
 * the machine that runs it, and the whole-day helpers that turn a picked date into the instants of a filter. Every date is invented.
 */

describe('AC-6: formatIst writes a time the way the audit screen shows it', () => {
  it('writes day, short month, year, 24-hour time and IST', () => {
    expect(formatIst(new Date('2026-11-06T11:30:00.000Z'))).toBe('06 Nov 2026, 17:00 IST');
  });

  it('keeps a leading zero on the day, the hour and the minute', () => {
    expect(formatIst(new Date('2026-12-01T22:35:00.000Z'))).toBe('02 Dec 2026, 04:05 IST');
  });

  it('crosses midnight in IST, not in UTC: 23:59 on one day, 00:00 on the next (edge case: time zone across midnight)', () => {
    expect(formatIst(new Date('2026-11-05T18:29:59.999Z'))).toBe('05 Nov 2026, 23:59 IST');
    expect(formatIst(new Date('2026-11-05T18:30:00.000Z'))).toBe('06 Nov 2026, 00:00 IST');
  });

  it('crosses the year in IST: 31 December in UTC is already the new year in India', () => {
    expect(formatIst(new Date('2026-12-31T18:30:00.000Z'))).toBe('01 Jan 2027, 00:00 IST');
  });

  it('writes "Sep" and not "Sept", whatever the locale data says', () => {
    expect(formatIst(new Date('2026-09-01T00:00:00.000Z'))).toBe('01 Sep 2026, 05:30 IST');
  });

  it('is the same for every month of the year (twelve short names)', () => {
    const months = Array.from({ length: 12 }, (_, index) => formatIst(new Date(Date.UTC(2026, index, 15, 6, 30))).slice(3, 6));
    expect(months).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
  });

  it('refuses an invalid date: that is a mistake in the code, not something to show', () => {
    expect(() => formatIst(new Date('not a date'))).toThrow(RangeError);
  });
});

describe('AC-6: whole IST days', () => {
  it('a day begins at 18:30 UTC the evening before', () => {
    expect(startOfIstDay('2026-11-06').toISOString()).toBe('2026-11-05T18:30:00.000Z');
  });

  it('the day after begins 24 hours later, so "to 06 Nov" includes everything on 06 Nov and nothing of 07 Nov', () => {
    expect(startOfNextIstDay('2026-11-06').toISOString()).toBe('2026-11-06T18:30:00.000Z');
    expect(startOfNextIstDay('2026-12-31').toISOString()).toBe('2026-12-31T18:30:00.000Z');
  });

  it('agrees with formatIst: the first instant of the day is 00:00 IST of that date', () => {
    expect(formatIst(startOfIstDay('2026-03-01'))).toBe('01 Mar 2026, 00:00 IST');
    expect(formatIst(new Date(startOfNextIstDay('2026-02-28').getTime() - 1))).toBe('28 Feb 2026, 23:59 IST');
  });

  it('knows a leap day', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
  });

  it.each(['2026-02-30', '2026-13-01', '2026-00-10', '2026-11-00', '2026-11-31', '26-11-06', '2026-1-6', '2026/11/06', '2026-11-06T00:00', ' 2026-11-06', '1999-12-31', '3000-01-01', ''])(
    'does not accept "%s" as a date',
    (text) => {
      expect(isIsoDate(text)).toBe(false);
      expect(() => startOfIstDay(text)).toThrow(RangeError);
    },
  );
});
