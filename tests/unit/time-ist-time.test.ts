import { describe, expect, it } from 'vitest';

import { formatIstTime } from '@/lib/time';

/**
 * STORY-05.08 AC-1: "Draft saved at 10:42 IST." The time of day alone, in IST, whatever the time zone of the machine. Every date is invented.
 */

describe('AC-1: formatIstTime writes the time of day in IST', () => {
  it('writes 24-hour time and IST, as the "Draft saved at" notice does', () => {
    expect(formatIstTime(new Date('2026-11-06T05:12:00.000Z'))).toBe('10:42 IST');
  });

  it('keeps a leading zero on the hour and the minute', () => {
    expect(formatIstTime(new Date('2026-12-01T22:35:00.000Z'))).toBe('04:05 IST');
  });

  it('crosses midnight in IST, not in UTC (edge case)', () => {
    expect(formatIstTime(new Date('2026-11-05T18:29:59.999Z'))).toBe('23:59 IST');
    expect(formatIstTime(new Date('2026-11-05T18:30:00.000Z'))).toBe('00:00 IST');
  });

  it('refuses an invalid date: that is a mistake in the code, not something to show', () => {
    expect(() => formatIstTime(new Date('not a date'))).toThrow(RangeError);
  });
});
