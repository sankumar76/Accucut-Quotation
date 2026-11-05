import { describe, expect, it, vi } from 'vitest';

import { createUser, listUsers, resetUserPassword, updateUser } from '@/lib/users/users-client';

/**
 * STORY-01.04 T4: the browser's calls to the users routes and the reading of their answers. `fetch` is replaced, so the
 * test answers for the server. Names and addresses are invented.
 */

const PERSON = { id: '00000000-0000-4000-8000-000000000001', name: 'Rohan Das', email: 'rohan.das@example.test', role: 'ENGINEER', isActive: true };

function answer(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function fetching(response: Response | Error) {
  return vi.fn((...args: Parameters<typeof fetch>) => {
    void args;
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  });
}

describe('listUsers', () => {
  it('reads the people', async () => {
    const doFetch = fetching(answer({ users: [PERSON] }));
    expect(await listUsers(doFetch)).toEqual({ status: 'ok', value: [PERSON] });
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/users');
    expect(doFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', credentials: 'same-origin' });
  });

  it.each([
    ['a body that is not the list', answer({ nope: true })],
    ['a person with a role that does not exist', answer({ users: [{ ...PERSON, role: 'OWNER' }] })],
    ['a person with a field of the wrong type', answer({ users: [{ ...PERSON, isActive: 'yes' }] })],
    ['a body that is not JSON', new Response('<html>', { status: 200 })],
  ])('is "failed" for %s, never a list that might be wrong', async (_name, response) => {
    expect(await listUsers(fetching(response))).toEqual({ status: 'failed' });
  });

  it('is "failed" when the network fails or the server faults', async () => {
    expect(await listUsers(fetching(new Error('offline')))).toEqual({ status: 'failed' });
    expect(await listUsers(fetching(answer({ code: 'INTERNAL_ERROR', title: 'x' }, 500)))).toEqual({ status: 'failed' });
  });
});

describe('createUser and updateUser', () => {
  it('posts JSON and reads the person back', async () => {
    const doFetch = fetching(answer(PERSON, 201));
    const input = { name: 'Rohan Das', email: 'rohan.das@example.test', role: 'ENGINEER', password: 'invented-1!' } as const;
    expect(await createUser(input, doFetch)).toEqual({ status: 'ok', value: PERSON });
    const init = doFetch.mock.calls[0]?.[1];
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } });
    expect(JSON.parse(String(init?.body))).toEqual(input);
  });

  it('patches the ID given, escaped, with only the changes', async () => {
    const doFetch = fetching(answer(PERSON));
    await updateUser('a/b', { isActive: false }, doFetch);
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/users/a%2Fb');
    expect(doFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'PATCH', body: '{"isActive":false}' });
  });

  it('reads a refusal: the code, the title, the message of each field and the Admin who holds the place', async () => {
    const refusal = {
      type: 'about:blank',
      title: 'Check the values and try again.',
      status: 422,
      code: 'EMAIL_TAKEN',
      requestId: 'req-0123abcd',
      errors: [
        { field: 'email', message: 'A user with this e-mail already exists.' },
        { field: 'email', message: 'a second message for the same field is ignored' },
        { field: 3, message: 'not a field name' },
      ],
    };
    expect(await createUser({ name: 'A', email: 'a@example.test', role: 'ENGINEER', password: 'x' }, fetching(answer(refusal, 422)))).toEqual({
      status: 'refused',
      httpStatus: 422,
      code: 'EMAIL_TAKEN',
      title: 'Check the values and try again.',
      fields: { email: 'A user with this e-mail already exists.' },
      currentAdminName: null,
    });
    const admin = { title: 'There is already an active Admin. Only one Admin can be active.', code: 'ADMIN_ALREADY_ACTIVE', currentAdmin: { id: 'u', name: 'Invented Admin' } };
    expect(await updateUser('u', { role: 'ADMIN' }, fetching(answer(admin, 409)))).toMatchObject({ status: 'refused', httpStatus: 409, currentAdminName: 'Invented Admin', fields: {} });
  });

  it('is "failed" for a 4xx whose body is not a problem', async () => {
    expect(await updateUser('u', { name: 'A' }, fetching(answer({ hello: 1 }, 400)))).toEqual({ status: 'failed' });
    expect(await updateUser('u', { name: 'A' }, fetching(new Response('nope', { status: 403 })))).toEqual({ status: 'failed' });
  });

  it('is "failed" when a success carries a person that cannot be read', async () => {
    expect(await createUser({ name: 'A', email: 'a@example.test', role: 'ENGINEER', password: 'x' }, fetching(answer({ id: 1 }, 201)))).toEqual({ status: 'failed' });
  });
});

describe('resetUserPassword', () => {
  it('posts the password and takes a 204 for success', async () => {
    const doFetch = fetching(new Response(null, { status: 204 }));
    expect(await resetUserPassword('u1', 'invented-1!', doFetch)).toEqual({ status: 'ok', value: true });
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/users/u1/password-reset');
    expect(JSON.parse(String(doFetch.mock.calls[0]?.[1]?.body))).toEqual({ password: 'invented-1!' });
  });

  it('reads a refusal of the password', async () => {
    const outcome = await resetUserPassword('u1', '', fetching(answer({ code: 'VALIDATION_FAILED', title: 't', errors: [{ field: 'password', message: 'Enter a password.' }] }, 422)));
    expect(outcome).toMatchObject({ status: 'refused', fields: { password: 'Enter a password.' } });
  });
});
