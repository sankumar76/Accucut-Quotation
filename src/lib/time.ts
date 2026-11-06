/**
 * The one source of "now" (test strategy principle 3, coding standards section 10 "Dates").
 *
 * Code that needs the time takes a `Clock` instead of calling `new Date()`, so a test can set the time and move
 * it (a 15-minute lock-out, a 12-hour session) without waiting. Production passes `systemClock`.
 *
 * Times are stored in UTC and shown in `Asia/Kolkata` (coding standards section 10, "Dates"). `formatIst` (story 01.07) is the
 * one way a time reaches the screen; the whole-day helpers turn a date the person picked into the instants a filter needs.
 * Story 04.01 adds the parsing of a deadline.
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
export const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;

/** The portal's time zone (FR-088): every time on a screen, in an e-mail or in a file is shown in it. */
export const IST_TIME_ZONE = 'Asia/Kolkata';

/** India is UTC+05:30 all year and has no daylight saving time, so a whole IST day is always 24 hours. */
const IST_OFFSET_MILLISECONDS = 5.5 * MILLISECONDS_PER_HOUR;

const IST_LABEL = 'IST';

const IST_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: IST_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function partOf(parts: ReadonlyArray<Intl.DateTimeFormatPart>, type: Intl.DateTimeFormatPartTypes): string {
  const found = parts.find((part) => part.type === type);
  if (found === undefined) throw new Error(`The date format has no ${type} part.`);
  return found.value;
}

/**
 * A time as the screens write it: "06 Nov 2026, 17:00 IST" (STORY-01.07 AC-6; UX spec SCR-16). The parts are put together
 * here, not taken from the locale's own pattern, so a change of the runtime's locale data ("Sept") cannot change the text.
 * An invalid date is a mistake in the code and throws.
 */
export function formatIst(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new RangeError('formatIst needs a valid date.');
  const parts = IST_PARTS.formatToParts(date);
  const day = partOf(parts, 'day');
  const month = partOf(parts, 'month');
  const year = partOf(parts, 'year');
  const hour = partOf(parts, 'hour');
  const minute = partOf(parts, 'minute');
  return `${day} ${month} ${year}, ${hour}:${minute} ${IST_LABEL}`;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const FIRST_YEAR = 2000;
const LAST_YEAR = 2999;

/** The day, month and year of a `YYYY-MM-DD` text that is a real calendar date in 2000 to 2999, or null. */
function calendarDateOf(isoDate: string): { readonly year: number; readonly month: number; readonly day: number } | null {
  const match = ISO_DATE.exec(isoDate);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < FIRST_YEAR || year > LAST_YEAR) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  const isReal = probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
  return isReal ? { year, month, day } : null;
}

/** Is this a `YYYY-MM-DD` text for a real date (no 30 February)? The form a date field and a query string use. */
export function isIsoDate(text: string): boolean {
  return calendarDateOf(text) !== null;
}

/** The instant a day begins in IST (00:00 IST, which is 18:30 UTC the evening before). Throws for a text that is not a real date. */
export function startOfIstDay(isoDate: string): Date {
  const date = calendarDateOf(isoDate);
  if (date === null) throw new RangeError('startOfIstDay needs a real date written YYYY-MM-DD.');
  return new Date(Date.UTC(date.year, date.month - 1, date.day) - IST_OFFSET_MILLISECONDS);
}

/** The instant the day after begins in IST: the exclusive end of the day, so "to 06 Nov" includes everything on 06 Nov. */
export function startOfNextIstDay(isoDate: string): Date {
  return new Date(startOfIstDay(isoDate).getTime() + MILLISECONDS_PER_DAY);
}
