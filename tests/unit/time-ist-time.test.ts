import { describe, expect, it } from 'vitest';

import { formatIstTime, istIsoDateOf, istTimeInputOf, parseIstDateTime } from '@/lib/time';

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

describe('STORY-04.07 AC-2: istTimeInputOf writes the time of day as a time control holds it', () => {
  it('writes HH:mm in IST, with the date control\'s half from istIsoDateOf, and parseIstDateTime puts them back together', () => {
    const stored = new Date('2026-11-12T11:30:00.000Z');
    expect(istIsoDateOf(stored)).toBe('2026-11-12');
    expect(istTimeInputOf(stored)).toBe('17:00');
    expect(parseIstDateTime(istIsoDateOf(stored), istTimeInputOf(stored))).toEqual(stored);
  });

  it('keeps 23:30 IST on its own IST day, where UTC is 18:00 on the same day, and crosses midnight in IST, not in UTC', () => {
    expect(istTimeInputOf(new Date('2026-11-09T18:00:00.000Z'))).toBe('23:30');
    expect(istTimeInputOf(new Date('2026-11-05T18:29:59.999Z'))).toBe('23:59');
    expect(istTimeInputOf(new Date('2026-11-05T18:30:00.000Z'))).toBe('00:00');
    expect(istIsoDateOf(new Date('2026-11-05T18:30:00.000Z'))).toBe('2026-11-06');
  });

  it('keeps a leading zero on the hour and the minute', () => {
    expect(istTimeInputOf(new Date('2026-12-01T22:35:00.000Z'))).toBe('04:05');
  });

  it('refuses an invalid date: that is a mistake in the code, not something to show', () => {
    expect(() => istTimeInputOf(new Date('not a date'))).toThrow(RangeError);
  });
});
