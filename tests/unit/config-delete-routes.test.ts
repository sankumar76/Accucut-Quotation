import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { fieldUses } from '@/lib/config/field-delete';
import { isProtectedField } from '@/lib/fields/protected';

import { defined } from '../support/defined';
import { HARNESS_PASSWORD } from '../support/harness-password';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../support/seed-config';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-08.04 AC-1, AC-2, AC-3, AC-4 and AC-9 through the real `withRoute`, the real session, the real structure service over the in-memory registry, the 15 seed rates and the real step-up check with its real
 * throttle: what the Admin is sent for the references read and for a delete; what a Lead, an Engineer and a signed-out caller are sent instead; the order of a delete's refusals (so a refusal costs nothing and a
 * blocked field never asks for a password); that the body is the password alone; and that the password is in no answer, no audit entry and no log line. Which roles are allowed on every route is
 * `tests/security/role-matrix.test.ts`, and that a refused role causes no lookup is `tests/security/engineer-refused-before-lookup.test.ts`. The table, the transaction, two deletes racing and the audit rollback
 * against PostgreSQL are `tests/integration/config/delete-field.test.ts`. Every name and password is invented.
 */

const logged = vi.hoisted(() => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: logged }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return {
    getAuthOptions: () => ({}),
    getUserRepository: () => shared.users,
    getUserService: () => shared.userService,
    getConfigReadService: () => shared.configReadService,
    getConfigEditService: () => shared.configEditService,
    getConfigStructureService: () => shared.configStructureService,
  };
});

const ORIGIN = 'https://portal.example.test';
const deleteRoute = await import('@/app/api/v1/config/fields/[id]/route');
const referencesRoute = await import('@/app/api/v1/config/fields/[id]/references/route');
const currentRoute = await import('@/app/api/v1/config/current/route');

const RATES = SEED_PROCESS_ITEMS.map(({ id, name }) => ({ id, name }));
/** A seed input that nothing uses and the portal does not need. */
const FREE = defined(seedConfig.fields.find((field) => field.kind === 'input' && !isProtectedField(field) && fieldUses(seedConfig, RATES, field.id).length === 0));
const USED = seedFieldAt('AL');
const WRONG = 'Not-the-right-1!';

const record = z.record(z.string(), z.unknown());
const asJson = async (response: Response) => record.parse(await response.json());

const headers = { origin: ORIGIN, 'content-type': 'application/json' };
const references = (id: string): Promise<Response> =>
  referencesRoute.GET(new Request(`${ORIGIN}/api/v1/config/fields/${id}/references`, { method: 'GET', headers: { origin: ORIGIN } }), { params: Promise.resolve({ id }) });
const remove = (id: string, body: unknown, over: Record<string, string> = {}): Promise<Response> =>
  deleteRoute.DELETE(new Request(`${ORIGIN}/api/v1/config/fields/${id}`, { method: 'DELETE', headers: { ...headers, ...over }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
const currentVersion = async (): Promise<unknown> => (await asJson(await currentRoute.GET(new Request(`${ORIGIN}/api/v1/config/current`, { method: 'GET', headers: { origin: ORIGIN } }))))['number'];

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);
beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ADMIN');
  for (const fn of Object.values(logged)) fn.mockClear();
});

describe('AC-1: the Admin alone', () => {
  // The delete's valid call that stores nothing is a protected field: 409 at any state, for the one role that may call it.
  const calls: ReadonlyArray<readonly [string, () => Promise<Response>, number]> = [
    ['GET /api/v1/config/fields/{id}/references', () => references(USED.id), 200],
    ['DELETE /api/v1/config/fields/{id}', () => remove(seedFieldAt('BG').id, { password: HARNESS_PASSWORD }), 409],
  ];

  it.each(calls)('%s answers the Admin %s', async (_name, call, status) => {
    expect((await call()).status).toBe(status);
  });

  it.each(calls)('%s answers a Lead and an Engineer the fixed 403, with no formula, label or letter', async (_name, call) => {
    for (const role of ['LEAD', 'ENGINEER'] as const) {
      harness.signInAs(role);
      const response = await call();
      expect(response.status).toBe(403);
      const text = await response.text();
      expect(text).not.toContain('Cutting');
      expect(text).not.toContain('{{');
      expect(record.parse(JSON.parse(text))['code']).toBe('FORBIDDEN');
    }
  });

  it.each(calls)('%s answers a signed-out caller 401', async (_name, call) => {
    harness.signInAs(null);
    expect((await call()).status).toBe(401);
  });

  it('has only the method the story names on each route', () => {
    expect(Object.keys(deleteRoute).sort()).toEqual(['DELETE']);
    expect(Object.keys(referencesRoute).sort()).toEqual(['GET']);
  });
});

describe('AC-2: the references read', () => {
  it('answers the field and every use as a strict object, a formula with its column, label and text in display form', async () => {
    const body = await asJson(await references(USED.id));
    expect(Object.keys(body).sort()).toEqual(['fieldId', 'label', 'letter', 'uses']);
    expect(body).toMatchObject({ fieldId: USED.id, letter: 'AL', label: USED.label });
    const uses = z.array(record).parse(body['uses']);
    expect(uses[0]).toEqual({ kind: 'formula', fieldId: seedFieldAt('AY').id, letter: 'AY', label: seedFieldAt('AY').label, formula: 'AL + AM + AN + AO + AP + AQ + AR + AS + AT + AU + AV + AW + AX' });
  });

  it('answers an empty list for a field nothing uses, and the other kinds of use by what they are (no formula text)', async () => {
    expect(await asJson(await references(FREE.id))).toMatchObject({ uses: [] });
    const flag = seedConfig.fields.find((field) => fieldUses(seedConfig, RATES, field.id).some((use) => use.kind === 'hide-when-zero'));
    const kinds = z.array(record).parse((await asJson(await references(defined(flag).id)))['uses']);
    for (const use of kinds.filter((each) => each['kind'] !== 'formula')) expect(Object.keys(use)).not.toContain('formula');
  });

  it('answers 404 for an ID that is none and 409 SYSTEM_FIELD for a protected field, as the delete does', async () => {
    expect((await references('no-such-field')).status).toBe(404);
    const protectedField = await references(seedFieldAt('BN').id);
    expect(protectedField.status).toBe(409);
    expect(await asJson(protectedField)).toMatchObject({ code: 'SYSTEM_FIELD' });
  });

  it('stores nothing and asks for nothing: no new version, no audit entry, no attempt counted', async () => {
    const entries = harness.auditWorld.audit.committed.length;
    await references(USED.id);
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
    expect(await currentVersion()).toBe(1);
  });
});

describe('AC-2, AC-4 and AC-5: the order of a delete\'s refusals', () => {
  it('answers a delete of a field that is used 409 FIELD_IN_USE with the same list, even with a wrong password, and asks for no password', async () => {
    const response = await remove(USED.id, { password: WRONG });
    expect(response.status).toBe(409);
    const body = await asJson(response);
    expect(body).toMatchObject({ code: 'FIELD_IN_USE', title: expect.stringMatching(/^Cannot delete AL .+ yet\./) });
    expect(body['uses']).toEqual((await asJson(await references(USED.id)))['uses']);
    expect(JSON.stringify(body)).not.toContain(WRONG);
    expect(await currentVersion()).toBe(1);
  });

  it('answers 404 for an ID that is none and 409 SYSTEM_FIELD for each protected field, with no password asked for', async () => {
    expect((await remove('no-such-field', { password: WRONG })).status).toBe(404);
    for (const letter of ['A', 'BG', 'BL', 'BM', 'BO', 'E', 'F', 'I', 'BH', 'BI', 'BJ', 'BK', 'BN']) {
      const response = await remove(seedFieldAt(letter).id, { password: WRONG });
      expect(response.status, letter).toBe(409);
      expect(await asJson(response), letter).toMatchObject({ code: 'SYSTEM_FIELD' });
    }
    expect(await currentVersion()).toBe(1);
  });

  it('answers a wrong password 422 STEP_UP_FAILED with the fixed sentence, writes nothing, and holds no password', async () => {
    const entries = harness.auditWorld.audit.committed.length;
    const response = await remove(FREE.id, { password: WRONG });
    expect(response.status).toBe(422);
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ code: 'STEP_UP_FAILED', title: 'That password is not correct.' });
    expect(text).not.toContain(WRONG);
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
    expect(await currentVersion()).toBe(1);
  });
});

describe('AC-9: the body is the password alone, and the write is checked for its origin', () => {
  it.each([
    ['a body with no password', {}],
    ['an empty password', { password: '' }],
    ['an unknown key beside the password', { password: HARNESS_PASSWORD, baseVersion: 1 }],
    ['a password that is not a string', { password: 12345 }],
  ])('refuses %s as a form error and asks for nothing', async (_what, body) => {
    expect((await remove(FREE.id, body)).status).toBe(422);
    expect(await currentVersion()).toBe(1);
  });

  it('refuses a delete from another origin before anything else', async () => {
    const response = await remove(FREE.id, { password: HARNESS_PASSWORD }, { origin: 'https://elsewhere.example.test' });
    expect(response.status).toBe(403);
    expect(await asJson(response)).toMatchObject({ code: 'ORIGIN_REFUSED' });
    expect(await currentVersion()).toBe(1);
  });
});

describe('AC-3, AC-6 and AC-8: the delete', () => {
  it('deletes with the right password as version 2, says so, writes the audit entry, and holds no password anywhere', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await remove(FREE.id, { password: HARNESS_PASSWORD });
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ version: 2, message: 'Field deleted. Configuration version 2.' });
    expect(text).not.toContain(HARNESS_PASSWORD);
    const entries = harness.auditWorld.audit.committed.slice(before);
    expect(entries).toHaveLength(1);
    expect(defined(entries[0])).toMatchObject({ event: 'config.field_deleted', actorId: harness.idOf.ADMIN, objectType: 'field', objectId: FREE.id });
    expect(JSON.stringify(entries)).not.toContain(HARNESS_PASSWORD);
    expect(JSON.stringify(Object.values(logged).map((fn) => fn.mock.calls))).not.toContain(HARNESS_PASSWORD);
    expect(await currentVersion()).toBe(2);
  });

  it('answers a second delete of the same field 404 (it is gone from the latest version), and the references read the same', async () => {
    expect((await remove(FREE.id, { password: HARNESS_PASSWORD })).status).toBe(404);
    expect((await references(FREE.id)).status).toBe(404);
    expect(await currentVersion()).toBe(2);
  });
});

describe('AC-4: five wrong passwords in a row lock the step-up, and the field is not deleted', () => {
  it('answers 429 STEP_UP_LOCKED with the fixed sentence from the sixth try, even with the right password, and stores nothing', async () => {
    const target = defined(seedConfig.fields.find((field) => field.kind === 'input' && field.id !== FREE.id && !isProtectedField(field) && fieldUses(seedConfig, RATES, field.id).length === 0));
    for (let attempt = 0; attempt < 5; attempt += 1) expect((await remove(target.id, { password: WRONG })).status).toBe(422);
    const locked = await remove(target.id, { password: HARNESS_PASSWORD });
    expect(locked.status).toBe(429);
    expect(await asJson(locked)).toMatchObject({ code: 'STEP_UP_LOCKED', title: 'Too many wrong passwords. Try again in 15 minutes.' });
    expect(await currentVersion()).toBe(2);
  });
});
