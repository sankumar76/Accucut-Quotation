import { describe, expect, it } from 'vitest';

import { accountThrottleKey, passwordChangeThrottleKey, stepUpThrottleKey, throttleKey, type ThrottleKind } from '@/server/auth/throttle-key';

/**
 * STORY-06.14 AC-3 and AC-4: the step-up check counts on a key of its own (`stepup` kind), so it can never share a count with sign-in, with
 * the change-password form or with an address. The keys are keyed hashes: the same inputs always give the same key, a different kind, value
 * or secret gives a different one, and the key never holds the value it was made from. Every secret and ID here is invented.
 */

const SECRET = 'invented-throttle-key-material';
const OTHER_SECRET = 'invented-reservation-test-key-material';
const USER_ID = '3f2a9c1e-5b7d-4e86-9a10-c4d8e2f61b07';
const KINDS: ReadonlyArray<ThrottleKind> = ['account', 'ip', 'password-change', 'stepup'];

describe('throttleKey', () => {
  it('is a 64-digit hex hash, the same every time for the same secret, kind and value', () => {
    const key = throttleKey(SECRET, 'stepup', USER_ID);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(throttleKey(SECRET, 'stepup', USER_ID)).toBe(key);
  });

  it('gives every kind its own key for one value, so no two counters can ever be the same row', () => {
    const keys = KINDS.map((kind) => throttleKey(SECRET, kind, USER_ID));
    expect(new Set(keys).size).toBe(KINDS.length);
  });

  it('gives another secret another key, so a leaked table cannot be rebuilt without AUTH_SECRET', () => {
    expect(throttleKey(OTHER_SECRET, 'stepup', USER_ID)).not.toBe(throttleKey(SECRET, 'stepup', USER_ID));
  });

  it('does not hold the value it was made from', () => {
    expect(throttleKey(SECRET, 'stepup', USER_ID)).not.toContain(USER_ID.replaceAll('-', ''));
  });
});

describe('stepUpThrottleKey (AC-3, AC-4)', () => {
  it('is the `stepup` key of the user ID', () => {
    expect(stepUpThrottleKey(SECRET, USER_ID)).toBe(throttleKey(SECRET, 'stepup', USER_ID));
  });

  it('reads the ID without regard to letter case, as PostgreSQL reads a uuid', () => {
    expect(stepUpThrottleKey(SECRET, USER_ID.toUpperCase())).toBe(stepUpThrottleKey(SECRET, USER_ID));
  });

  it('differs from the sign-in key, the change-password key and the address key of the same person', () => {
    const stepUp = stepUpThrottleKey(SECRET, USER_ID);
    expect(stepUp).not.toBe(accountThrottleKey(SECRET, 'person@example.test'));
    expect(stepUp).not.toBe(passwordChangeThrottleKey(SECRET, USER_ID));
    expect(stepUp).not.toBe(throttleKey(SECRET, 'ip', USER_ID));
    expect(stepUp).not.toBe(throttleKey(SECRET, 'account', USER_ID));
  });

  it('is one key for one person and a different key for another', () => {
    expect(stepUpThrottleKey(SECRET, '8a1d6e40-2c93-4f5b-b7e2-0d59c3a18f46')).not.toBe(stepUpThrottleKey(SECRET, USER_ID));
  });
});

describe('the existing keys are unchanged', () => {
  it('normalises an e-mail for the account key (lower case, no surrounding spaces)', () => {
    expect(accountThrottleKey(SECRET, '  Person@Example.TEST ')).toBe(throttleKey(SECRET, 'account', 'person@example.test'));
  });

  it('lower-cases the ID for the change-password key', () => {
    expect(passwordChangeThrottleKey(SECRET, USER_ID.toUpperCase())).toBe(throttleKey(SECRET, 'password-change', USER_ID));
  });
});
