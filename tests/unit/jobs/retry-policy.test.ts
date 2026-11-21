import { describe, expect, it } from 'vitest';

import { MAX_SEND_ATTEMPTS, nextAttempt, RETRY_BACKOFF_MINUTES } from '@/server/jobs/outbox-send';

/**
 * STORY-09.06 AC-1: the retry policy is one pure function. 1st failure +1 minute, 2nd +5, 3rd +15, and the 4th (the first send and three retries) is final.
 */

const NOW = new Date('2026-11-20T10:00:00.000Z');
const minutesAfter = (minutes: number): Date => new Date(NOW.getTime() + minutes * 60_000);

describe('nextAttempt (AC-1)', () => {
  it('AC-1: the backoff is 1, 5 and 15 minutes, and four attempts are allowed', () => {
    expect(RETRY_BACKOFF_MINUTES).toEqual([1, 5, 15]);
    expect(MAX_SEND_ATTEMPTS).toBe(4);
  });

  it.each([
    [1, 1],
    [2, 5],
    [3, 15],
  ])('AC-1: after failed attempt %i the next is due exactly %i minutes later', (attempts, minutes) => {
    expect(nextAttempt(attempts, NOW)).toEqual(minutesAfter(minutes));
  });

  it('AC-1: after the 4th failed attempt there is no next one (the row is final)', () => {
    expect(nextAttempt(4, NOW)).toBeNull();
    expect(nextAttempt(9, NOW)).toBeNull();
  });

  it('is measured from the time given, not from the system clock', () => {
    const later = new Date('2027-01-01T00:00:00.000Z');
    expect(nextAttempt(1, later)).toEqual(new Date('2027-01-01T00:01:00.000Z'));
  });

  it.each([0, -1, 1.5, Number.NaN])('an attempt number of %s is a programming error', (attempts) => {
    expect(() => nextAttempt(attempts, NOW)).toThrow(RangeError);
  });
});
