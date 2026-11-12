import { describe, expect, it } from 'vitest';

import { queueTitleFor, roleLabel } from '@/lib/auth/roles';
import {
  EMAIL_INVALID_MESSAGE,
  EMAIL_REQUIRED_MESSAGE,
  emailProblem,
  PASSWORD_REQUIRED_MESSAGE,
  passwordProblem,
} from '@/lib/auth/sign-in-validation';
import { createFixedClock, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE, systemClock } from '@/lib/time';
import { clientAddressFrom } from '@/server/auth/client-address';
import {
  hasSessionEnded,
  isWithinSession,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_ENDED_NOTICE_DAYS,
  SESSION_HOURS,
  SESSION_MAX_AGE_SECONDS,
  sessionSecondsLeft,
  sessionTokenSchema,
} from '@/server/auth/session-token';

/** Small pure parts of STORY-01.01: the clock, the role words, the form checks, the client address and the session age. */

describe('the clock (test strategy principle 3)', () => {
  it('a fixed clock stays where it is put and moves only when told', () => {
    const clock = createFixedClock(new Date('2026-11-04T09:00:00Z'));
    expect(clock.now().toISOString()).toBe('2026-11-04T09:00:00.000Z');
    clock.advance(15 * MILLISECONDS_PER_MINUTE);
    expect(clock.now().toISOString()).toBe('2026-11-04T09:15:00.000Z');
    clock.set(new Date('2027-01-01T00:00:00Z'));
    expect(clock.now().toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('a fixed clock returns a new date each time, so a caller cannot move it', () => {
    const clock = createFixedClock(new Date('2026-11-04T09:00:00Z'));
    clock.now().setUTCFullYear(1999);
    expect(clock.now().getUTCFullYear()).toBe(2026);
  });

  it('a clock never goes back; set() is the way to jump', () => {
    expect(() => createFixedClock(new Date()).advance(-1)).toThrow(RangeError);
  });

  it('the system clock returns an instant that is not older than the moment the test started', () => {
    const before = Date.now();
    expect(systemClock.now().getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe('role words', () => {
  it.each([
    ['ADMIN', 'Admin', 'Task queue'],
    ['LEAD', 'Lead', 'Task queue'],
    ['ENGINEER', 'Engineer', 'My tasks'],
  ] as const)('%s is shown as %s and lands on "%s" (AC-1)', (role, label, title) => {
    expect(roleLabel(role)).toBe(label);
    expect(queueTitleFor(role)).toBe(title);
  });
});

describe('sign-in form checks (SCR-01 fields)', () => {
  it.each([
    ['', EMAIL_REQUIRED_MESSAGE],
    ['   ', EMAIL_REQUIRED_MESSAGE],
    ['not-an-address', EMAIL_INVALID_MESSAGE],
    ['name@', EMAIL_INVALID_MESSAGE],
    ['name@company.com', null],
    ['  name@company.com  ', null],
  ])('e-mail "%s" gives %s', (value, expected) => {
    expect(emailProblem(value)).toBe(expected);
  });

  it('the password must be present, and is never trimmed: a space is a character', () => {
    expect(passwordProblem('')).toBe(PASSWORD_REQUIRED_MESSAGE);
    expect(passwordProblem(' ')).toBeNull();
    expect(passwordProblem('x')).toBeNull();
  });
});

describe('client address (per-address limit)', () => {
  it('takes the last entry of X-Forwarded-For, the one our own proxy wrote', () => {
    expect(clientAddressFrom({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' })).toBe('203.0.113.9');
  });

  it('reads a header that arrives as a list', () => {
    expect(clientAddressFrom({ 'x-forwarded-for': ['1.2.3.4', '203.0.113.9'] })).toBe('203.0.113.9');
  });

  it('accepts an IPv6 address, lower-cased', () => {
    expect(clientAddressFrom({ 'x-forwarded-for': '2001:DB8::1' })).toBe('2001:db8::1');
  });

  it.each([undefined, {}, { 'x-forwarded-for': 'not an address' }, { 'x-forwarded-for': '1.2.3.4, evil' }, { 'x-forwarded-for': 7 }, { 'x-forwarded-for': '' }])(
    '%j gives no address',
    (headers) => {
      expect(clientAddressFrom(headers)).toBeNull();
    },
  );
});

describe('AC-5: the session is 12 hours from sign-in', () => {
  const signedAt = Date.parse('2026-11-04T09:00:00Z') / 1_000;

  it('is 12 hours, in seconds', () => {
    expect(SESSION_HOURS).toBe(12);
    expect(SESSION_MAX_AGE_SECONDS).toBe(12 * 60 * 60);
  });

  it('accepts a request just before 12 hours and refuses one at 12 hours', () => {
    const start = signedAt * 1_000;
    expect(isWithinSession(signedAt, new Date(start + SESSION_HOURS * MILLISECONDS_PER_HOUR - 1_000))).toBe(true);
    expect(isWithinSession(signedAt, new Date(start + SESSION_HOURS * MILLISECONDS_PER_HOUR))).toBe(false);
  });

  it('refuses a sign-in time in the future', () => {
    expect(isWithinSession(signedAt, new Date((signedAt - 1) * 1_000))).toBe(false);
  });

  it('STORY-01.06 AC-1: 11 h 59 m 59 s after sign-in is accepted, 12 h 00 m 01 s is refused, and exactly 12 h is over', () => {
    const start = signedAt * 1_000;
    const twelveHours = SESSION_HOURS * MILLISECONDS_PER_HOUR;
    expect(isWithinSession(signedAt, new Date(start + twelveHours - 1_000))).toBe(true);
    expect(hasSessionEnded(signedAt, new Date(start + twelveHours - 1_000))).toBe(false);
    expect(isWithinSession(signedAt, new Date(start + twelveHours + 1_000))).toBe(false);
    expect(hasSessionEnded(signedAt, new Date(start + twelveHours + 1_000))).toBe(true);
    expect(hasSessionEnded(signedAt, new Date(start + twelveHours))).toBe(true);
  });

  it('STORY-01.06: a sign-in time in the future is not "ended" (it is not a session at all)', () => {
    expect(hasSessionEnded(signedAt, new Date((signedAt - 1) * 1_000))).toBe(false);
  });

  it('STORY-01.06 AC-2: the time left counts down from sign-in and never goes below zero', () => {
    const start = signedAt * 1_000;
    expect(sessionSecondsLeft(signedAt, new Date(start))).toBe(SESSION_MAX_AGE_SECONDS);
    expect(sessionSecondsLeft(signedAt, new Date(start + 6 * MILLISECONDS_PER_HOUR))).toBe(6 * 60 * 60);
    expect(sessionSecondsLeft(signedAt, new Date(start + 6 * MILLISECONDS_PER_HOUR + 400))).toBe(6 * 60 * 60);
    expect(sessionSecondsLeft(signedAt, new Date(start + 13 * MILLISECONDS_PER_HOUR))).toBe(0);
  });

  it('STORY-01.06: the cookie outlives the token by a stated number of days, so a person coming back can be told', () => {
    expect(SESSION_ENDED_NOTICE_DAYS).toBe(7);
    expect(SESSION_COOKIE_MAX_AGE_SECONDS).toBe(SESSION_MAX_AGE_SECONDS + 7 * 24 * 60 * 60);
  });

  it('the token schema holds the user, the version and the sign-in time, and rejects anything incomplete', () => {
    expect(sessionTokenSchema.safeParse({ sub: 'u', sv: 0, signedAt: 1 }).success).toBe(true);
    expect(sessionTokenSchema.safeParse({ sub: '', sv: 0, signedAt: 1 }).success).toBe(false);
    expect(sessionTokenSchema.safeParse({ sub: 'u', sv: -1, signedAt: 1 }).success).toBe(false);
    expect(sessionTokenSchema.safeParse({ sub: 'u', sv: 0 }).success).toBe(false);
  });
});
