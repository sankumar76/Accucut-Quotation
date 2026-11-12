import { describe, expect, it, vi } from 'vitest';

import { changeOwnPassword } from '@/lib/auth/account-client';
import {
  changePasswordProblems,
  CURRENT_PASSWORD_REQUIRED_MESSAGE,
  NEW_PASSWORD_REQUIRED_MESSAGE,
  PASSWORDS_DIFFER_MESSAGE,
  REPEAT_PASSWORD_REQUIRED_MESSAGE,
} from '@/lib/auth/change-password';

/**
 * STORY-01.05 AC-2, AC-3 and AC-7: what the change-password form checks before it sends anything (the UX spec's words), and the browser's
 * one call to the route. The server decides the rest (the current password, the common-password list, the attempt limit). Every password
 * here is invented.
 */

const EMAIL = 'rohan.das@example.test';
const GOOD = { currentPassword: 'Tn4#vLm8@Qz-current', newPassword: 'Pr9$kWd3!Rx-fresh', repeatPassword: 'Pr9$kWd3!Rx-fresh' };

describe('changePasswordProblems', () => {
  it('finds nothing wrong with a filled form whose new password meets the rule and is repeated', () => {
    expect(changePasswordProblems(GOOD, EMAIL)).toEqual({});
  });

  it('asks for each empty field in its own words', () => {
    expect(changePasswordProblems({ currentPassword: '', newPassword: '', repeatPassword: '' }, EMAIL)).toEqual({
      currentPassword: CURRENT_PASSWORD_REQUIRED_MESSAGE,
      newPassword: NEW_PASSWORD_REQUIRED_MESSAGE,
      repeatPassword: REPEAT_PASSWORD_REQUIRED_MESSAGE,
    });
  });

  it.each([
    ['too short', 'Ab7!xyzuv', 'The new password must be at least 10 characters.'],
    ['too long', `Ab7!${'x'.repeat(125)}`, 'Use 128 characters or fewer.'],
    ['without a number or a symbol', 'abcdefghijkl', 'Add at least one number and one symbol, such as ! # $ or %.'],
    ['without a number', 'abcdef-ghijkl', 'Add at least one number.'],
    ['without a symbol', 'abcdefghijk7', 'Add at least one symbol, such as ! # $ or %.'],
    ['the e-mail address', 'Rohan.Das@Example.test', 'The password cannot be the same as your e-mail address.'],
  ])('names the part of the rule a new password that is %s fails, in the person\'s own words', (_name, newPassword, message) => {
    expect(changePasswordProblems({ ...GOOD, newPassword, repeatPassword: newPassword }, EMAIL)).toEqual({ newPassword: message });
  });

  it('says the two new passwords do not match, and only then, under the repeat field', () => {
    expect(changePasswordProblems({ ...GOOD, repeatPassword: 'Pr9$kWd3!Rx-fresh ' }, EMAIL)).toEqual({ repeatPassword: PASSWORDS_DIFFER_MESSAGE });
    expect(PASSWORDS_DIFFER_MESSAGE).toBe('The two new passwords do not match.');
  });

  it('never trims: a trailing space is part of the password and of the comparison', () => {
    const spaced = 'Pr9$kWd3 Rx fresh ';
    expect(changePasswordProblems({ ...GOOD, newPassword: spaced, repeatPassword: spaced }, EMAIL)).toEqual({});
  });

  it('leaves the common-password check to the server (the page has no list)', () => {
    expect(changePasswordProblems({ ...GOOD, newPassword: 'Welcome@123', repeatPassword: 'Welcome@123' }, EMAIL)).toEqual({});
  });

  it('reports all three at once, in the order of the form', () => {
    const found = changePasswordProblems({ currentPassword: '', newPassword: 'short', repeatPassword: 'other' }, EMAIL);
    expect(Object.keys(found)).toEqual(['currentPassword', 'newPassword', 'repeatPassword']);
  });
});

describe('changeOwnPassword (the call)', () => {
  const json = (body: unknown, status: number): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/problem+json' } });

  it('posts both passwords as JSON to the account route and takes a 204 for success', async () => {
    const doFetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    expect(await changeOwnPassword({ currentPassword: 'a', newPassword: 'b' }, doFetch)).toEqual({ status: 'ok', value: true });
    const [path, init] = doFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe('/api/v1/account/password');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ currentPassword: 'a', newPassword: 'b' });
  });

  it('reads a 422 as a refusal with the message under its field', async () => {
    const doFetch = () =>
      Promise.resolve(json({ code: 'CURRENT_PASSWORD_WRONG', title: 't', errors: [{ field: 'currentPassword', message: 'Your current password is not correct.' }] }, 422));
    expect(await changeOwnPassword({ currentPassword: 'a', newPassword: 'b' }, doFetch)).toMatchObject({
      status: 'refused',
      httpStatus: 422,
      code: 'CURRENT_PASSWORD_WRONG',
      fields: { currentPassword: 'Your current password is not correct.' },
    });
  });

  it('reads the 429 as a refusal with its code', async () => {
    const doFetch = () => Promise.resolve(json({ code: 'TOO_MANY_ATTEMPTS', title: 'Too many attempts. Try again in 15 minutes.' }, 429));
    expect(await changeOwnPassword({ currentPassword: 'a', newPassword: 'b' }, doFetch)).toMatchObject({ status: 'refused', httpStatus: 429, code: 'TOO_MANY_ATTEMPTS' });
  });

  it('a server fault or a network failure is "failed", not a refusal', async () => {
    expect(await changeOwnPassword({ currentPassword: 'a', newPassword: 'b' }, () => Promise.resolve(json({ code: 'INTERNAL_ERROR', title: 'x' }, 500)))).toEqual({ status: 'failed' });
    expect(await changeOwnPassword({ currentPassword: 'a', newPassword: 'b' }, () => Promise.reject(new Error('offline')))).toEqual({ status: 'failed' });
  });
});
