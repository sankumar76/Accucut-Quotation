import { describe, expect, it, vi } from 'vitest';

import { STEP_UP_FAILED_MESSAGE } from '@/lib/auth/step-up';
import { handOverCandidates, HAND_OVER_WRONG_PASSWORD_MESSAGE } from '@/lib/users/hand-over';
import { handOverAdminRole, type UserRow } from '@/lib/users/users-client';

/**
 * STORY-01.09 AC-1 (the choice the dialog offers) and AC-2 (the browser's call and the wrong-password sentence). `fetch` is replaced, so the test answers for the server. Names and IDs are invented.
 */

const person = (id: string, name: string, role: UserRow['role'], isActive = true): UserRow => ({ id, name, email: `${name.toLowerCase().replaceAll(' ', '.')}@example.test`, role, isActive });
const ADMIN = person('00000000-0000-4000-8000-0000000000a1', 'Arjun Rai', 'ADMIN');
const LEAD = person('00000000-0000-4000-8000-0000000000b1', 'Meera Nair', 'LEAD');
const ENGINEER = person('00000000-0000-4000-8000-0000000000c1', 'Rohan Das', 'ENGINEER');
const GONE = person('00000000-0000-4000-8000-0000000000d1', 'Isha Rao', 'ENGINEER', false);
const FORMER_ADMIN = person('00000000-0000-4000-8000-0000000000e1', 'Old Admin', 'ADMIN', false);

describe('AC-1: the choice holds the other active people, whatever their role', () => {
  it('offers a Lead and an Engineer, never the Admin themself, never a deactivated person (an old, deactivated Admin included), in the list order', () => {
    expect(handOverCandidates([ADMIN, LEAD, ENGINEER, GONE, FORMER_ADMIN], ADMIN.id)).toEqual([LEAD, ENGINEER]);
  });

  it('compares the signed-in ID without regard to letter case, as the server does', () => {
    expect(handOverCandidates([ADMIN, LEAD], ADMIN.id.toUpperCase())).toEqual([LEAD]);
    expect(handOverCandidates([{ ...ADMIN, id: ADMIN.id.toUpperCase() }, LEAD], ADMIN.id)).toEqual([LEAD]);
  });

  it('is empty when nobody else is active (the dialog then says to add a user)', () => {
    expect(handOverCandidates([ADMIN, GONE], ADMIN.id)).toEqual([]);
    expect(handOverCandidates([], ADMIN.id)).toEqual([]);
  });
});

describe('AC-2: the state "Hand over: wrong password" says the spec\'s sentence', () => {
  it('is the step-up sentence and "Try again."', () => {
    expect(HAND_OVER_WRONG_PASSWORD_MESSAGE).toBe(`${STEP_UP_FAILED_MESSAGE} Try again.`);
    expect(HAND_OVER_WRONG_PASSWORD_MESSAGE).toBe('That password is not correct. Try again.');
  });
});

function answer(body: unknown, status: number): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function fetching(response: Response | Error) {
  return vi.fn((...args: Parameters<typeof fetch>) => {
    void args;
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  });
}

describe('handOverAdminRole', () => {
  it('posts only the password to the person in the path (encoded), and takes a 204 for success', async () => {
    const doFetch = fetching(new Response(null, { status: 204 }));
    expect(await handOverAdminRole('a/b?c', 'invented-1!', doFetch)).toEqual({ status: 'ok', value: true });
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/users/a%2Fb%3Fc/admin-handover');
    expect(doFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(JSON.parse(String(doFetch.mock.calls[0]?.[1]?.body))).toEqual({ password: 'invented-1!' });
  });

  it.each([
    ['a wrong password', 422, { code: 'STEP_UP_FAILED', title: 'That password is not correct.' }],
    ['a blocked step-up', 429, { code: 'STEP_UP_LOCKED', title: 'Too many wrong passwords. Try again in 15 minutes.' }],
    ['the caller', 409, { code: 'CANNOT_HAND_OVER_TO_SELF', title: 'You are the Admin already. Choose another person.' }],
    ['a deactivated person', 409, { code: 'HAND_OVER_TARGET_INACTIVE', title: 'That person is deactivated.' }],
    ['an unknown person', 404, { code: 'NOT_FOUND', title: 'User not found.' }],
    ['a caller who is no longer the Admin', 403, { code: 'FORBIDDEN', title: 'You do not have access to this.' }],
  ])('reads %s as a refusal with the server\'s code and words', async (_name, status, body) => {
    expect(await handOverAdminRole('u1', 'x', fetching(answer(body, status)))).toMatchObject({ status: 'refused', httpStatus: status, code: body.code, title: body.title });
  });

  it('is "failed", not a crash, for a network fault, a server fault and an answer that is not a problem body', async () => {
    expect(await handOverAdminRole('u1', 'x', fetching(new Error('offline')))).toEqual({ status: 'failed' });
    expect(await handOverAdminRole('u1', 'x', fetching(answer({ code: 'INTERNAL_ERROR', title: 'x' }, 500)))).toEqual({ status: 'failed' });
    expect(await handOverAdminRole('u1', 'x', fetching(new Response('<html>', { status: 422 })))).toEqual({ status: 'failed' });
  });
});
