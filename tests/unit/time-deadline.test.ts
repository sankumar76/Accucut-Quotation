import { describe, expect, it } from 'vitest';

import { formatIst, istYearOf, parseIstDateTime } from '@/lib/time';

/**
 * STORY-04.01 T2 (AC-2, AC-3; NFR-015): a deadline typed in IST becomes a UTC instant and shows the same IST date and time again, and the year of a task
 * code is the year in IST. Every date is invented.
 */

describe('AC-2, AC-3: parseIstDateTime turns the date and time a person typed (IST) into the UTC instant', () => {
  it('reads 23:30 IST as 18:00 UTC the same day, and shows 23:30 on the right IST date again (NFR-015)', () => {
    const parsed = parseIstDateTime('2026-11-09', '23:30');
    expect(parsed?.toISOString()).toBe('2026-11-09T18:00:00.000Z');
    expect(formatIst(parsed ?? new Date(0))).toBe('09 Nov 2026, 23:30 IST');
  });

  it('reads 03:00 IST as 21:30 UTC the evening before, and still shows the IST date that was typed (NFR-015)', () => {
    const parsed = parseIstDateTime('2026-11-09', '03:00');
    expect(parsed?.toISOString()).toBe('2026-11-08T21:30:00.000Z');
    expect(formatIst(parsed ?? new Date(0))).toBe('09 Nov 2026, 03:00 IST');
  });

  it('reads midnight as the start of the IST day and 23:59 as its last minute', () => {
    expect(parseIstDateTime('2026-03-01', '00:00')?.toISOString()).toBe('2026-02-28T18:30:00.000Z');
    expect(parseIstDateTime('2026-03-01', '23:59')?.toISOString()).toBe('2026-03-01T18:29:00.000Z');
  });

  it('crosses the year the IST way: 00:01 on 1 January 2027 is 18:31 UTC on 31 December 2026', () => {
    expect(parseIstDateTime('2027-01-01', '00:01')?.toISOString()).toBe('2026-12-31T18:31:00.000Z');
  });

  it.each([
    ['2026-02-30', '10:00'],
    ['2026-13-01', '10:00'],
    ['', '10:00'],
    ['2026-11-09', ''],
    ['2026-11-09', '24:00'],
    ['2026-11-09', '10:60'],
    ['2026-11-09', '9:05'],
    ['2026-11-09', '10:00:30'],
    ['2026-11-09', '10:00 IST'],
    ['2026-11-09T10:00', '10:00'],
  ])('does not accept the date "%s" with the time "%s"', (date, time) => {
    expect(parseIstDateTime(date, time)).toBeNull();
  });
});

describe('AC-2: istYearOf is the year in IST, which is the year of a task code', () => {
  it('is 2027 at 2026-12-31 18:31 UTC (00:01 on 1 January in IST) and 2026 one minute before', () => {
    expect(istYearOf(new Date('2026-12-31T18:31:00.000Z'))).toBe(2027);
    expect(istYearOf(new Date('2026-12-31T18:29:59.999Z'))).toBe(2026);
  });

  it('is the year of the first and the last instant of an IST year', () => {
    expect(istYearOf(new Date('2026-12-31T18:30:00.000Z'))).toBe(2027);
    expect(istYearOf(new Date('2027-12-31T18:29:59.999Z'))).toBe(2027);
  });

  it('is the UTC year in the middle of the year', () => {
    expect(istYearOf(new Date('2026-06-15T12:00:00.000Z'))).toBe(2026);
  });
});
