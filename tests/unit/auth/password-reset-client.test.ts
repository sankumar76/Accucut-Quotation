import { describe, expect, it } from 'vitest';

import { resetPasswordProblems } from '@/lib/auth/password-reset';
import { forgotResultOf, requestResetLink, resetPasswordWithLink, resetResultOf } from '@/lib/auth/reset-client';

/**
 * STORY-09.07 (SCR-02) the browser's side: what the reset form checks before it posts, what each call sends, and how every answer of the server is read. The server answers for a fake `fetch`.
 * Every value is invented.
 */

const problem = (status: number, code: string, title: string, errors?: ReadonlyArray<{ field: string; message: string }>) =>
  new Response(JSON.stringify({ type: 'about:blank', title, status, code, requestId: 'req-00000000', ...(errors === undefined ? {} : { errors }) }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });

describe('resetPasswordProblems (checked on submit)', () => {
  it('is empty for two matching passwords that meet the parts of the rule that need no list', () => {
    expect(resetPasswordProblems({ newPassword: 'Pr9$kWd3!Rx-fresh', repeatPassword: 'Pr9$kWd3!Rx-fresh' })).toEqual({});
  });

  it.each([
    [{ newPassword: '', repeatPassword: '' }, { newPassword: 'Enter a new password.', repeatPassword: 'Repeat the new password.' }],
    [{ newPassword: 'Ab1!', repeatPassword: 'Ab1!' }, { newPassword: 'The new password must be at least 10 characters.' }],
    [{ newPassword: 'abcdefghijkl', repeatPassword: 'abcdefghijkl' }, { newPassword: 'Add at least one number and one symbol, such as ! # $ or %.' }],
    [{ newPassword: 'Pr9$kWd3!Rx-fresh', repeatPassword: 'Pr9$kWd3!Rx-fresX' }, { repeatPassword: 'The two passwords do not match.' }],
    [{ newPassword: 'Pr9$kWd3!Rx-fresh', repeatPassword: '' }, { repeatPassword: 'Repeat the new password.' }],
  ])('%j gives %j', (values, expected) => {
    expect(resetPasswordProblems(values)).toEqual(expected);
  });

  it('does not trim: a space is part of a password', () => {
    expect(resetPasswordProblems({ newPassword: 'Pr9$kWd3!Rx fresh ', repeatPassword: 'Pr9$kWd3!Rx fresh' })).toEqual({ repeatPassword: 'The two passwords do not match.' });
  });
});

describe('the two calls', () => {
  it('requestResetLink posts the e-mail as JSON to the forgot route and reads the one message', async () => {
    const calls: Array<{ path: string; init: RequestInit }> = [];
    const fake = (path: string | URL | Request, init?: RequestInit): Promise<Response> => {
      calls.push({ path: String(path), init: init ?? {} });
      return Promise.resolve(Response.json({ message: 'Check your e-mail.' }, { status: 202 }));
    };
    const outcome = await requestResetLink('name@example.test', fake);
    expect(outcome).toEqual({ status: 'ok', value: 'Check your e-mail.' });
    expect(calls[0]?.path).toBe('/api/v1/account/password/forgot');
    expect(calls[0]?.init.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ email: 'name@example.test' });
  });

  it('resetPasswordWithLink posts the token and the password in the body, never in the address', async () => {
    const calls: Array<{ path: string; init: RequestInit }> = [];
    const fake = (path: string | URL | Request, init?: RequestInit): Promise<Response> => {
      calls.push({ path: String(path), init: init ?? {} });
      return Promise.resolve(new Response(null, { status: 204 }));
    };
    expect(await resetPasswordWithLink('the-token', 'the-password', fake)).toEqual({ status: 'ok', value: true });
    expect(calls[0]?.path).toBe('/api/v1/account/password/reset');
    expect(calls[0]?.path).not.toContain('the-token');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ token: 'the-token', newPassword: 'the-password' });
  });

  it('a 202 without the message is a failure, not a success', async () => {
    const fake = (): Promise<Response> => Promise.resolve(Response.json({}, { status: 202 }));
    expect(await requestResetLink('name@example.test', fake)).toEqual({ status: 'failed' });
  });
});

describe('forgotResultOf: how the request form reads the answer', () => {
  const run = async (response: Response) => forgotResultOf(await requestResetLink('name@example.test', () => Promise.resolve(response)));

  it('sent: the one message', async () => {
    expect(await run(Response.json({ message: 'Check your e-mail.' }, { status: 202 }))).toEqual({ kind: 'sent', message: 'Check your e-mail.' });
  });

  it('blocked: the server\'s own words', async () => {
    expect(await run(problem(429, 'TOO_MANY_ATTEMPTS', 'Too many requests. Try again in 15 minutes.'))).toEqual({ kind: 'blocked', message: 'Too many requests. Try again in 15 minutes.' });
  });

  it('field: a 422 under the e-mail', async () => {
    expect(await run(problem(422, 'VALIDATION_FAILED', 'Check the values and try again.', [{ field: 'email', message: 'Enter an e-mail address like name@company.com.' }]))).toEqual({
      kind: 'field',
      message: 'Enter an e-mail address like name@company.com.',
    });
  });

  it('failed: a server fault, a 403 with no field and a network error', async () => {
    expect(await run(problem(500, 'INTERNAL_ERROR', 'Something went wrong on our side.'))).toEqual({ kind: 'failed' });
    expect(await run(problem(403, 'ORIGIN_REFUSED', 'This request did not come from the portal.'))).toEqual({ kind: 'failed' });
    expect(forgotResultOf(await requestResetLink('name@example.test', () => Promise.reject(new Error('offline'))))).toEqual({ kind: 'failed' });
  });
});

describe('resetResultOf: how the reset form reads the answer', () => {
  const run = async (response: Response) => resetResultOf(await resetPasswordWithLink('t', 'p', () => Promise.resolve(response)));

  it('done: 204', async () => {
    expect(await run(new Response(null, { status: 204 }))).toEqual({ kind: 'done' });
  });

  it('invalid: 400 RESET_LINK_INVALID', async () => {
    expect(await run(problem(400, 'RESET_LINK_INVALID', 'This link has already been used or has expired. Ask for a new link.'))).toEqual({ kind: 'invalid' });
  });

  it('fields: a 422 that names the new password', async () => {
    expect(await run(problem(422, 'PASSWORD_RULE', 'Check the values and try again.', [{ field: 'newPassword', message: 'That password is too common. Choose a different one.' }]))).toEqual({
      kind: 'fields',
      problems: { newPassword: 'That password is too common. Choose a different one.' },
    });
  });

  it('failed: a server fault, and a refusal with no field and no code this form knows', async () => {
    expect(await run(problem(500, 'INTERNAL_ERROR', 'Something went wrong on our side.'))).toEqual({ kind: 'failed' });
    expect(await run(problem(403, 'ORIGIN_REFUSED', 'This request did not come from the portal.'))).toEqual({ kind: 'failed' });
  });
});
