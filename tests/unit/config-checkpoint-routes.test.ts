import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createTransactionHandle } from '@/server/repositories/transaction';

import { defined } from '../support/defined';
import { HARNESS_PASSWORD } from '../support/harness-password';
import { inputAfterAx } from '../support/insert-specs';
import { SEED_PROCESS_ITEMS } from '../support/seed-config';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-08.06 AC-2 to AC-4, AC-7, AC-8 and AC-9 through the real `withRoute`, the real session, the real checkpoint service over the in-memory registry and checkpoints, and the real step-up check with its real
 * throttle: what the Admin is sent for the list, the save and the revert; what a Lead, an Engineer and a signed-out caller are sent instead; the status of each refusal and its code; that the bodies are strict objects;
 * and that the password is in no answer, no audit entry and no log line. Which roles are allowed on every route is `tests/security/role-matrix.test.ts`, and that a refused role causes no lookup is
 * `tests/security/engineer-refused-before-lookup.test.ts`. The table, the transaction, two reverts racing and the audit rollback against PostgreSQL are `tests/integration/config/checkpoints-revert.test.ts`.
 * Every name and password is invented.
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
    getConfigCheckpointService: () => shared.configCheckpointService,
  };
});

const ORIGIN = 'https://portal.example.test';
const checkpointsRoute = await import('@/app/api/v1/config/checkpoints/route');
const revertRoute = await import('@/app/api/v1/config/versions/[id]/revert/route');
const currentRoute = await import('@/app/api/v1/config/current/route');

const WRONG = 'Not-the-right-1!';
const CUTTING_RATE_ID = defined(SEED_PROCESS_ITEMS.find((item) => item.name === 'Cutting-Rate-per-Sec')).id;
const record = z.record(z.string(), z.unknown());
const asJson = async (response: Response) => record.parse(await response.json());
const headers = { origin: ORIGIN, 'content-type': 'application/json' };

const list = (): Promise<Response> => checkpointsRoute.GET(new Request(`${ORIGIN}/api/v1/config/checkpoints`, { method: 'GET', headers: { origin: ORIGIN } }));
const save = (body: unknown, over: Record<string, string> = {}): Promise<Response> =>
  checkpointsRoute.POST(new Request(`${ORIGIN}/api/v1/config/checkpoints`, { method: 'POST', headers: { ...headers, ...over }, body: JSON.stringify(body) }));
const revert = (id: string, body: unknown, over: Record<string, string> = {}): Promise<Response> =>
  revertRoute.POST(new Request(`${ORIGIN}/api/v1/config/versions/${id}/revert`, { method: 'POST', headers: { ...headers, ...over }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
const currentVersion = async (): Promise<unknown> => (await asJson(await currentRoute.GET(new Request(`${ORIGIN}/api/v1/config/current`, { method: 'GET', headers: { origin: ORIGIN } }))))['number'];

/** The Admin's own caller, for the one change the routes do not make (an insert, which makes version 2 to revert from). */
const adminCaller = () => ({ user: { id: harness.idOf.ADMIN, name: 'Invented Admin', role: 'ADMIN' as const }, requestId: 'req-0000a0a0' });

/** The version the first checkpoint names (the seed, version 1). */
const firstVersionIdOf = (): string => harness.checkpointRepository.rows[0]?.versionId ?? '';

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);
beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ADMIN');
  for (const fn of Object.values(logged)) fn.mockClear();
});

describe('AC-9: the Admin alone', () => {
  // The calls that store nothing and answer the same at every state (`checkpoint-calls.ts`).
  const calls: ReadonlyArray<readonly [string, () => Promise<Response>, number]> = [
    ['GET /api/v1/config/checkpoints', () => list(), 200],
    ['POST /api/v1/config/checkpoints', () => save({ name: '' }), 422],
    ['POST /api/v1/config/versions/{id}/revert', () => revert('00000000-0000-4000-8000-0ccc0000f001', { password: HARNESS_PASSWORD, baseVersion: 9999 }), 409],
  ];

  it.each(calls)('%s answers the Admin %s', async (_name, call, status) => {
    expect((await call()).status).toBe(status);
  });

  it.each(calls)('%s answers a Lead and an Engineer the fixed 403, with no name, version or formula', async (_name, call) => {
    for (const role of ['LEAD', 'ENGINEER'] as const) {
      harness.signInAs(role);
      const response = await call();
      expect(response.status).toBe(403);
      const text = await response.text();
      expect(text).not.toContain('Original');
      expect(record.parse(JSON.parse(text))['code']).toBe('FORBIDDEN');
    }
  });

  it.each(calls)('%s answers a signed-out caller 401', async (_name, call) => {
    harness.signInAs(null);
    expect((await call()).status).toBe(401);
  });

  it('has only the methods the story names on each route', () => {
    expect(Object.keys(checkpointsRoute).sort()).toEqual(['GET', 'POST']);
    expect(Object.keys(revertRoute).sort()).toEqual(['POST']);
  });
});

describe('AC-2: the save', () => {
  it('answers 201 with the row for the latest version, a strict object with no snapshot, and stores no version and no audit entry (D-1)', async () => {
    const entries = harness.auditWorld.audit.committed.length;
    const response = await save({ name: '  Invented   First ' });
    expect(response.status).toBe(201);
    const body = await asJson(response);
    expect(Object.keys(body).sort()).toEqual(['id', 'name', 'savedAt', 'savedBy', 'versionId', 'versionNumber']);
    expect(body).toMatchObject({ name: 'Invented First', versionNumber: 1, savedBy: 'Invented Admin' });
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
    expect(await currentVersion()).toBe(1);
  });

  it('answers 422 with the sentence for the name field for an empty and a 101-character name, and 409 CHECKPOINT_NAME_TAKEN for a name in another letter case', async () => {
    const empty = await save({ name: '   ' });
    expect(empty.status).toBe(422);
    expect(await asJson(empty)).toMatchObject({ errors: [{ field: 'name', message: 'Enter a name for this checkpoint.' }] });
    expect((await save({ name: 'a'.repeat(101) })).status).toBe(422);
    const taken = await save({ name: 'INVENTED FIRST' });
    expect(taken.status).toBe(409);
    expect(await asJson(taken)).toMatchObject({ code: 'CHECKPOINT_NAME_TAKEN', title: 'A checkpoint with this name already exists. Names must be unique.' });
  });

  it.each([
    ['no name', {}],
    ['a name that is not a string', { name: 12 }],
    ['an unknown key beside the name', { name: 'Invented Strict', versionId: 'x' }],
  ])('refuses %s as a form error', async (_what, body) => {
    expect((await save(body)).status).toBe(422);
  });

  it('refuses a save from another origin before anything else', async () => {
    const response = await save({ name: 'Invented Elsewhere' }, { origin: 'https://elsewhere.example.test' });
    expect(response.status).toBe(403);
    expect(await asJson(response)).toMatchObject({ code: 'ORIGIN_REFUSED' });
  });
});

describe('AC-3: the list', () => {
  it('answers the checkpoints newest first as a strict object, with no snapshot', async () => {
    await save({ name: 'Invented Second' });
    const body = await asJson(await list());
    expect(Object.keys(body)).toEqual(['checkpoints']);
    const rows = z.array(record).parse(body['checkpoints']);
    expect(rows.map((row) => row['name'])).toEqual(['Invented Second', 'Invented First']);
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(['id', 'name', 'savedAt', 'savedBy', 'versionId', 'versionNumber']);
  });
});

describe('AC-4, AC-7 and AC-8: the revert', () => {
  let firstVersionId = '';

  it('refuses a body with an unknown key, no password or no base version as a form error, and an ID that is no UUID', async () => {
    firstVersionId = z.string().parse(defined(z.array(record).parse((await asJson(await list()))['checkpoints']).at(-1))['versionId']);
    for (const body of [{ password: HARNESS_PASSWORD, baseVersion: 1, extra: true }, { baseVersion: 1 }, { password: HARNESS_PASSWORD }, { password: '', baseVersion: 1 }, { password: HARNESS_PASSWORD, baseVersion: 0 }]) {
      expect((await revert(firstVersionId, body)).status).toBe(422);
    }
    expect((await revert('not-a-uuid', { password: HARNESS_PASSWORD, baseVersion: 1 })).status).toBe(422);
  });

  it('answers 404 for a version that is none, 409 CONFIG_VERSION_CHANGED for a stale base and 409 NOTHING_TO_REVERT for the current content, each with no password asked for', async () => {
    expect((await revert('00000000-0000-4000-8000-00000000dead', { password: WRONG, baseVersion: 1 })).status).toBe(404);
    const stale = await revert(firstVersionId, { password: WRONG, baseVersion: 7 });
    expect(stale.status).toBe(409);
    expect(await asJson(stale)).toMatchObject({ code: 'CONFIG_VERSION_CHANGED' });
    const same = await revert(firstVersionId, { password: WRONG, baseVersion: 1 });
    expect(same.status).toBe(409);
    expect(await asJson(same)).toMatchObject({ code: 'NOTHING_TO_REVERT', title: 'This checkpoint is the same as the current configuration.' });
    expect(await currentVersion()).toBe(1);
  });

  it('answers a wrong password 422 STEP_UP_FAILED with the fixed sentence, writes nothing and holds no password', async () => {
    await harness.configStructureService.insertFields(adminCaller(), { spec: inputAfterAx({ label: 'Invented Route Input' }), baseVersion: 1 });
    const entries = harness.auditWorld.audit.committed.length;
    const response = await revert(firstVersionId, { password: WRONG, baseVersion: 2 });
    expect(response.status).toBe(422);
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ code: 'STEP_UP_FAILED', title: 'That password is not correct.' });
    expect(text).not.toContain(WRONG);
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
    expect(await currentVersion()).toBe(2);
  });

  it('reverts with the right password as version 3, answers {version, copiedFrom, undoVersionId}, writes one config.reverted entry, and holds no password anywhere', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await revert(firstVersionId, { password: HARNESS_PASSWORD, baseVersion: 2 });
    expect(response.status).toBe(200);
    const text = await response.text();
    const body = record.parse(JSON.parse(text));
    expect(Object.keys(body).sort()).toEqual(['copiedFrom', 'undoVersionId', 'version']);
    expect(body).toMatchObject({ version: 3, copiedFrom: 1 });
    expect(text).not.toContain(HARNESS_PASSWORD);
    const entries = harness.auditWorld.audit.committed.slice(before);
    expect(entries).toHaveLength(1);
    expect(defined(entries[0])).toMatchObject({ event: 'config.reverted', actorId: harness.idOf.ADMIN, objectType: 'config_version', objectId: firstVersionId, objectLabel: 'Checkpoint "Invented Second"' });
    // Two checkpoints name version 1 (saved with no change between); the Object names the newest.
    expect(JSON.stringify(entries)).not.toContain(HARNESS_PASSWORD);
    expect(JSON.stringify(Object.values(logged).map((fn) => fn.mock.calls))).not.toContain(HARNESS_PASSWORD);
    expect(await currentVersion()).toBe(3);
  });

  it('undoes it: the undo version is a revert like any other and makes version 4 with the Object "Version 2"', async () => {
    // The answer of the revert above named the version that was latest before it; the harness's second version has the predictable ID of its number.
    const second = await asJson(await revert(`${firstVersionId.slice(0, -2)}02`, { password: HARNESS_PASSWORD, baseVersion: 3 }));
    expect(second).toMatchObject({ version: 4, copiedFrom: 2 });
    const entry = defined(harness.auditWorld.audit.committed.at(-1));
    expect(entry).toMatchObject({ event: 'config.reverted', objectLabel: 'Version 2' });
  });
});

describe('AC-4: five wrong passwords in a row lock the step-up, and nothing is reverted', () => {
  it('answers 429 STEP_UP_LOCKED with the fixed sentence from the sixth try, even with the right password, and stores nothing', async () => {
    // Version 1 differs from version 4 (a copy of version 2), so every check before the password passes.
    const target = firstVersionIdOf();
    for (let attempt = 0; attempt < 5; attempt += 1) expect((await revert(target, { password: WRONG, baseVersion: 4 })).status).toBe(422);
    const locked = await revert(target, { password: HARNESS_PASSWORD, baseVersion: 4 });
    expect(locked.status).toBe(429);
    expect(await asJson(locked)).toMatchObject({ code: 'STEP_UP_LOCKED', title: 'Too many wrong passwords. Try again in 15 minutes.' });
    expect(await currentVersion()).toBe(4);
  });
});

describe('AC-5: a target that can no longer be used, as the route answers it', () => {
  it('answers 422 with one sentence for each field in `errors` (the title is the generic one), no rate name, and asks no password', async () => {
    // The Process master loses a rate that version 1 reads (this is the last test of the file: the lock test above needs version 1 usable).
    expect(await harness.masters.deleteProcessItem(CUTTING_RATE_ID, createTransactionHandle())).toBe(true);
    const response = await revert(firstVersionIdOf(), { password: WRONG, baseVersion: 4 });
    expect(response.status).toBe(422);
    const text = await response.text();
    const body = record.parse(JSON.parse(text));
    expect(body['code']).toBe('VALIDATION_FAILED');
    expect(body['title']).not.toContain('Process master');
    const errors = z.array(record).parse(body['errors']);
    expect(errors.length).toBeGreaterThan(0);
    for (const error of errors) expect(error['message']).toMatch(/^[A-Z]{1,3} .+ uses a rate that is no longer in the Process master.$/);
    expect(errors.map((error) => error['field'])).toContain('AL Cutting Cost');
    expect(text).not.toContain('Cutting-Rate-per-Sec');
    expect(text).not.toContain(WRONG);
    expect(await currentVersion()).toBe(4);
  });
});
