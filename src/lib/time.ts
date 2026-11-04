/**
 * The one source of "now" (test strategy principle 3, coding standards section 10 "Dates").
 *
 * Code that needs the time takes a `Clock` instead of calling `new Date()`, so a test can set the time and move
 * it (a 15-minute lock-out, a 12-hour session) without waiting. Production passes `systemClock`.
 *
 * Story 01.07 adds the `Asia/Kolkata` formatting and story 04.01 the parsing; they are not here yet.
 */

export interface Clock {
  /** The current instant. Returns a new `Date` each call, so a caller may keep or change it. */
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** A clock a test controls. */
export interface FixedClock extends Clock {
  /** Moves the clock forward by `milliseconds` (it never goes back). */
  advance(milliseconds: number): void;
  /** Sets the clock to an exact instant. */
  set(instant: Date): void;
}

/** A clock that stays where it is put until a test moves it. */
export function createFixedClock(start: Date): FixedClock {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advance(milliseconds) {
      if (milliseconds < 0) throw new RangeError('A clock only moves forward; use set() to jump.');
      current += milliseconds;
    },
    set(instant) {
      current = instant.getTime();
    },
  };
}

export const MILLISECONDS_PER_SECOND = 1_000;
export const MILLISECONDS_PER_MINUTE = 60 * MILLISECONDS_PER_SECOND;
export const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE;
