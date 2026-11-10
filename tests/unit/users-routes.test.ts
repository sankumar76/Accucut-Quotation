import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-01.04 T3 (AC-1, AC-3, AC-4, AC-5): the contract of the three users routes, through the real `withRoute`, the real
 * session and the real user service over in-memory repositories. What the body must look like, what each refusal says, and
 * that no answer holds a password or its hash. Who may call is `tests/security`. Every name and address is invented.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getUserService: () => shared.userService };
});

const ORIGIN = 'https://portal.example.test';
const SECRET_LOOKING = 'invented-secret-looking-value-77';

const { GET, POST } = await import('@/app/api/v1/users/route');
const { PATCH } = await import('@/app/api/v1/users/[id]/route');
const { POST: RESET } = await import('@/app/api/v1/users/[id]/password-reset/route');

const record = z.record(z.string(), z.unknown());

function request(method: string, body?: unknown): Request {
  return new Request(`${ORIGIN}/api/v1/users`, {
    method,
    headers: { origin: ORIGIN, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const withId = (id: string) => ({ params: Promise.resolve({ id }) });
const newPerson = { name: '  Rohan Das ', email: ' Rohan.Das@Example.TEST ', role: 'ENGINEER', password: SECRET_LOOKING };

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ADMIN');
});

describe('GET /api/v1/users', () => {
  it('lists everyone with name, e-mail, role and active flag, and no other field', async () => {
    const response = await GET(request('GET'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const body = record.parse(await response.json());
    const users = z.array(record).parse(body['users']);
    expect(users.length).toBeGreaterThanOrEqual(3);
    for (const user of users) expect(Object.keys(user).sort()).toEqual(['email', 'id', 'isActive', 'name', 'role']);
    expect(JSON.stringify(body)).not.toMatch(/hash|password|session/i);
  });
});

describe('POST /api/v1/users (AC-1)', () => {
  it('adds a person: 201, the trimmed name, the lower-case e-mail, and neither the password nor its hash in the answer', async () => {
    const response = await POST(request('POST', newPerson));
    expect(response.status).toBe(201);
    const text = await response.text();
    expect(record.parse(JSON.parse(text))).toEqual({ id: expect.any(String), name: 'Rohan Das', email: 'rohan.das@example.test', role: 'ENGINEER', isActive: true });
    expect(text).not.toContain(SECRET_LOOKING);
    expect(text).not.toMatch(/hash|password/i);
    expect(harness.users.records.find((entry) => entry.email === 'rohan.das@example.test')?.passwordHash).not.toBe(SECRET_LOOKING);
  });

  it.each([
    ['not an address', { email: 'not-an-address' }, 'email', 'Enter an e-mail address like name@company.com.'],
    ['no e-mail', { email: '' }, 'email', 'Enter an e-mail address like name@company.com.'],
    ['no name', { name: '   ' }, 'name', 'Enter a name.'],
    ['no password', { password: '' }, 'password', 'Enter a password.'],
    ['a role that does not exist', { role: 'OWNER' }, 'role', 'Choose a role.'],
    ['a password over the limit', { password: 'x'.repeat(129) }, 'password', 'Use 128 characters or fewer.'],
  ])('refuses %s with 422 and the message under its field', async (_name, change, field, message) => {
    const response = await POST(request('POST', { ...newPerson, email: 'valid@example.test', ...change }));
    expect(response.status).toBe(422);
    const body = record.parse(await response.json());
    expect(body['code']).toBe('VALIDATION_FAILED');
    expect(body['errors']).toEqual([{ field, message }]);
  });

  it('refuses a key it does not know (no setting the hash, the session or the flag directly)', async () => {
    for (const extra of [{ passwordHash: 'x' }, { isActive: false }, { sessionVersion: 9 }, { mustChangePassword: false }]) {
      expect((await POST(request('POST', { ...newPerson, ...extra }))).status).toBe(422);
    }
  });

  it('refuses an e-mail that differs from an existing one only in letter case: "A user with this e-mail already exists."', async () => {
    const response = await POST(request('POST', { ...newPerson, email: 'INVENTED.LEAD@example.test' }));
    expect(response.status).toBe(422);
    const body = record.parse(await response.json());
    expect(body['code']).toBe('EMAIL_TAKEN');
    expect(body['errors']).toEqual([{ field: 'email', message: 'A user with this e-mail already exists.' }]);
  });

  it('never echoes the password in a refusal', async () => {
    const response = await POST(request('POST', { ...newPerson, email: 'not-an-address' }));
    expect(await response.text()).not.toContain(SECRET_LOOKING);
  });

  it('a body that is not JSON is 400', async () => {
    const response = await POST(new Request(`${ORIGIN}/api/v1/users`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{not json' }));
    expect(response.status).toBe(400);
  });
});

describe('AC-3: a second Admin is 409 and names the current one', () => {
  it('on POST', async () => {
    const response = await POST(request('POST', { ...newPerson, email: 'second.admin@example.test', role: 'ADMIN' }));
    expect(response.status).toBe(409);
    expect(record.parse(await response.json())).toMatchObject({
      title: 'There is already an active Admin. Only one Admin can be active.',
      code: 'ADMIN_ALREADY_ACTIVE',
      currentAdmin: { id: harness.idOf.ADMIN, name: 'Invented Admin' },
    });
    expect(harness.users.records.some((entry) => entry.email === 'second.admin@example.test')).toBe(false);
  });

  it('on PATCH, promoting a Lead', async () => {
    const response = await PATCH(request('PATCH', { role: 'ADMIN' }), withId(harness.idOf.LEAD));
    expect(response.status).toBe(409);
    expect(record.parse(await response.json())).toMatchObject({ code: 'ADMIN_ALREADY_ACTIVE', currentAdmin: { name: 'Invented Admin' } });
    expect(harness.users.records.find((entry) => entry.id === harness.idOf.LEAD)?.role).toBe('LEAD');
  });
});

describe('PATCH /api/v1/users/{id} (AC-1, AC-4)', () => {
  it('changes the name and the role, and deactivates and activates', async () => {
    const renamed = await PATCH(request('PATCH', { name: ' Renamed ', role: 'LEAD' }), withId(harness.targetId));
    expect(renamed.status).toBe(200);
    expect(record.parse(await renamed.json())).toMatchObject({ id: harness.targetId, name: 'Renamed', role: 'LEAD', isActive: true });
    expect(record.parse(await (await PATCH(request('PATCH', { isActive: false }), withId(harness.targetId))).json())['isActive']).toBe(false);
    expect(record.parse(await (await PATCH(request('PATCH', { isActive: true }), withId(harness.targetId))).json())['isActive']).toBe(true);
  });

  it('refuses the Admin their own deactivation and their own role change with 409, whatever the screen shows', async () => {
    const own = withId(harness.idOf.ADMIN);
    for (const body of [{ isActive: false }, { role: 'LEAD' }]) {
      const response = await PATCH(request('PATCH', body), own);
      expect(response.status).toBe(409);
    }
    expect(harness.users.records.find((entry) => entry.id === harness.idOf.ADMIN)).toMatchObject({ role: 'ADMIN', isActive: true });
  });

  it.each([
    ['an empty body', {}],
    ['the e-mail (it does not change)', { email: 'other@example.test' }],
    ['a key it does not know', { passwordHash: 'x' }],
    ['a role that does not exist', { role: 'OWNER' }],
    ['an active flag that is not true or false', { isActive: 'no' }],
  ])('refuses %s with 422', async (_name, body) => {
    expect((await PATCH(request('PATCH', body), withId(harness.targetId))).status).toBe(422);
  });

  it('refuses an ID that is not a UUID with 422, and a UUID nobody has with 404', async () => {
    expect((await PATCH(request('PATCH', { name: 'X' }), withId('not-a-uuid'))).status).toBe(422);
    expect((await PATCH(request('PATCH', { name: 'X' }), withId('00000000-0000-4000-8000-0000000000ff'))).status).toBe(404);
  });
});

describe('POST /api/v1/users/{id}/password-reset (AC-5)', () => {
  it('answers 204 with no body, and sets a temporary password that ends the old sessions', async () => {
    const before = harness.users.records.find((entry) => entry.id === harness.targetId)?.sessionVersion ?? 0;
    const response = await RESET(request('POST', { password: SECRET_LOOKING }), withId(harness.targetId));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(harness.users.records.find((entry) => entry.id === harness.targetId)).toMatchObject({ mustChangePassword: true, sessionVersion: before + 1 });
  });

  it('STD-01: refuses the Admin their own password with 409 CANNOT_RESET_OWN_PASSWORD, whatever the screen shows', async () => {
    const own = harness.users.records.find((entry) => entry.id === harness.idOf.ADMIN);
    const before = JSON.stringify(own);
    const response = await RESET(request('POST', { password: SECRET_LOOKING }), withId(harness.idOf.ADMIN));
    expect(response.status).toBe(409);
    const text = await response.text();
    expect(record.parse(JSON.parse(text))['code']).toBe('CANNOT_RESET_OWN_PASSWORD');
    expect(text).not.toContain(SECRET_LOOKING);
    expect(JSON.stringify(harness.users.records.find((entry) => entry.id === harness.idOf.ADMIN))).toBe(before);
  });

  it('STD-01: the own-account rules hold when the ID in the address is written in upper case (the database ignores case)', async () => {
    const own = withId(harness.idOf.ADMIN.toUpperCase());
    expect((await RESET(request('POST', { password: SECRET_LOOKING }), own)).status).toBe(409);
    expect((await PATCH(request('PATCH', { isActive: false }), own)).status).toBe(409);
    expect((await PATCH(request('PATCH', { role: 'LEAD' }), own)).status).toBe(409);
    expect(harness.users.records.find((entry) => entry.id === harness.idOf.ADMIN)).toMatchObject({ role: 'ADMIN', isActive: true });
  });

  it('needs a non-empty password and does not echo what was sent', async () => {
    const empty = await RESET(request('POST', { password: '' }), withId(harness.targetId));
    expect(empty.status).toBe(422);
    expect(record.parse(await empty.json())['errors']).toEqual([{ field: 'password', message: 'Enter a password.' }]);
    const extra = await RESET(request('POST', { password: SECRET_LOOKING, role: 'ADMIN' }), withId(harness.targetId));
    expect(extra.status).toBe(422);
    expect(await extra.text()).not.toContain(SECRET_LOOKING);
  });

  it('answers 404 for a UUID nobody has', async () => {
    expect((await RESET(request('POST', { password: SECRET_LOOKING }), withId('00000000-0000-4000-8000-0000000000ff'))).status).toBe(404);
  });
});
