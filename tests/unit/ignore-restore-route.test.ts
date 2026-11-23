import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { checkIgnoreRemarks, IGNORE_REMARKS_MAX_LENGTH } from '@/lib/estimate/ignore-words';
import { TRANSITION_REFUSALS, type EstimateStatus } from '@/lib/estimate/state-machine';
import { ignoreAnswerSchema, restoreAnswerSchema } from '@/server/views/schemas/estimates';

import { defined } from '../support/defined';
import { fixedForbiddenProblem } from '../support/scanner';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * CR-01 item 7D, AC-1, AC-2, AC-4, AC-5 and AC-9 (AQP-401; FR-109; NFR-001, NFR-002, NFR-007; architecture section 4.12 c), through the real `withRoute`, the real session and the real estimate status service over
 * in-memory storage: a Lead or an Admin ignores an estimate with remarks and restores it; the answers are the status underneath and the layer (a time, a name, the Lead's words), or the status alone, and nothing else; a
 * Quoted estimate, a second Ignore and a Restore of what is not ignored are each their own 409 and write no layer and no audit entry; empty, over-long and hidden-character remarks are a 422 under `remarks` and never
 * a 500; Restore has no body and no remarks of its own; an Engineer is the fixed 403 before the ID is looked at, and nobody signed in is 401; two Ignores at once leave exactly one layer and one entry. Who may call the routes
 * is `tests/security/role-matrix.test.ts`; the PostgreSQL side (the row lock, the CHECKs, the status coming back from each of Draft, Prepared and Approved) is `tests/integration/estimates/ignore-restore.test.ts`.
 * Every name, ID and number is invented.
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
  return {
    getAuthOptions: () => ({}),
    getUserRepository: () => shared.users,
    getEstimateService: () => shared.estimateService,
    getEstimateStatusService: () => shared.estimateStatusService,
  };
});

const ORIGIN = 'https://portal.example.test';
const UNKNOWN_ESTIMATE_ID = '00000000-0000-4000-8000-00000000dead';
const REMARKS = 'Not taken forward.\nThe customer chose another supplier.';
const { POST: IGNORE } = await import('@/app/api/v1/estimates/[id]/ignore/route');
const { POST: RESTORE } = await import('@/app/api/v1/estimates/[id]/restore/route');

const record = z.record(z.string(), z.unknown());

const post = (path: 'ignore' | 'restore', body?: unknown, origin: string = ORIGIN): Request =>
  body === undefined
    ? new Request(`${ORIGIN}/api/v1/estimates/x/${path}`, { method: 'POST', headers: { origin } })
    : new Request(`${ORIGIN}/api/v1/estimates/x/${path}`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const withId = (id: string) => ({ params: Promise.resolve({ id }) });
const estimate = () => defined(harness.estimateWorld.estimates[0]);
const owned = (): string => estimate().id;
const bodyOf = async (response: Response): Promise<Record<string, unknown>> => record.parse(await response.json());
const ignorePress = (body: unknown = { remarks: REMARKS }): Promise<Response> => IGNORE(post('ignore', body), withId(owned()));
const restorePress = (): Promise<Response> => RESTORE(post('restore'), withId(owned()));
const entries = (event: string) => harness.calculationAudit.rows.filter((row) => row.event === event);

/** The recipe's estimate (a Draft) in the given status, ignored or not. */
function setStatus(status: EstimateStatus, ignored = false): void {
  estimate().status = status;
  if (ignored) {
    estimate().ignoredAt = new Date('2026-11-20T10:00:00.000Z');
    estimate().ignoredBy = harness.idOf.LEAD;
    estimate().ignoreRemarks = 'First remarks.';
  }
}

/** What a refusal must have left alone: the status, the layer and the audit entries. */
function snapshot() {
  return { status: estimate().status, ignoredAt: estimate().ignoredAt ?? null, remarks: estimate().ignoreRemarks ?? null, audit: harness.calculationAudit.rows.length };
}

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('LEAD');
});

/** Puts the harness estimate back as the recipe made it, whatever a test did. */
afterEach(() => {
  const held = estimate();
  held.status = 'DRAFT';
  delete held.quotedBy;
  delete held.quotedAt;
  held.ignoredAt = null;
  delete held.ignoredBy;
  delete held.ignoreRemarks;
  harness.calculationAudit.rows.length = 0;
  vi.restoreAllMocks();
});

describe('AC-1, AC-5, AC-9: a good Ignore sets the layer, keeps the status and writes one audit entry together', () => {
  it.each([
    ['LEAD', () => harness.idOf.LEAD, 'Invented Lead'],
    ['ADMIN', () => harness.idOf.ADMIN, 'Invented Admin'],
  ] as const)('%s: 200 with the status and the layer (a time, a name, the remarks) and nothing else; the estimate is ignored by the person; one entry', async (role, personId, label) => {
    harness.signInAs(role);
    setStatus('PREPARED');
    const response = await ignorePress();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const answer = await bodyOf(response);
    expect(Object.keys(answer).sort()).toEqual(['ignored', 'status']);
    expect(Object.keys(record.parse(answer['ignored'])).sort()).toEqual(['at', 'byName', 'remarks']);
    expect(ignoreAnswerSchema.parse(answer)).toMatchObject({ status: 'PREPARED', ignored: { remarks: REMARKS } });
    expect(estimate()).toMatchObject({ status: 'PREPARED', ignoredBy: personId(), ignoreRemarks: REMARKS });
    expect(entries('estimate.ignored')).toHaveLength(1);
    expect(defined(entries('estimate.ignored')[0])).toMatchObject({ actorId: personId(), actorLabel: label, objectId: owned(), before: { status: 'PREPARED' }, after: { status: 'PREPARED', remarks: REMARKS } });
  });

  it.each<EstimateStatus>(['DRAFT', 'PREPARED', 'APPROVED'])('a %s estimate is ignored and keeps its status', async (status) => {
    setStatus(status);
    expect((await ignorePress()).status).toBe(200);
    expect(estimate().status).toBe(status);
  });

  it('the body names nothing but the remarks: a person, a time or a status in it is refused (a strict schema), and nothing is written', async () => {
    const before = snapshot();
    const response = await ignorePress({ remarks: REMARKS, ignoredBy: 'someone-else', ignoredAt: '2020-01-01T00:00:00.000Z', status: 'APPROVED' });
    expect(response.status).toBe(422);
    expect(snapshot()).toEqual(before);
  });

  it('an audit entry that cannot be written takes the layer with it', async () => {
    const before = snapshot();
    vi.spyOn(harness.calculationAudit.service, 'record').mockRejectedValueOnce(new Error('Invented audit failure.'));
    expect((await ignorePress()).status).toBe(500);
    expect(snapshot()).toEqual(before);
    expect(estimate().ignoredAt ?? null).toBeNull();
  });

  it('a request from another origin is refused before anything else, for both routes, and the estimate is as it was', async () => {
    const ignored = await IGNORE(post('ignore', { remarks: REMARKS }, 'https://elsewhere.example.test'), withId(owned()));
    const restored = await RESTORE(post('restore', undefined, 'https://elsewhere.example.test'), withId(owned()));
    for (const response of [ignored, restored]) {
      expect(response.status).toBe(403);
      expect(await bodyOf(response)).toMatchObject({ code: 'ORIGIN_REFUSED' });
    }
    expect(estimate().ignoredAt ?? null).toBeNull();
  });
});

describe('AC-2: the remarks are judged by the shared rule, a 422 under `remarks` and never a 500', () => {
  it.each([
    ['empty', ''],
    ['no key at all', undefined],
    ['spaces and line breaks', '  \n\t '],
    ['501 code points', 'x'.repeat(IGNORE_REMARKS_MAX_LENGTH + 1)],
    ['a zero-width joiner', 'Not taken‍ forward'],
    ['a bidirectional override', 'Not taken‮ forward'],
    ['a NUL', 'Not taken\u0000 forward'],
    ['a lone surrogate', 'Not taken\uD800 forward'],
  ])('%s: 422 with the message of the shared rule under remarks, and nothing is written', async (_name, remarks) => {
    const before = snapshot();
    const response = await ignorePress(remarks === undefined ? {} : { remarks });
    expect(response.status).toBe(422);
    const body = await bodyOf(response);
    const checked = checkIgnoreRemarks(remarks ?? '');
    if (checked.ok) throw new Error('The remarks should be refused.');
    expect(JSON.stringify(body.errors)).toContain(checked.message);
    expect(z.array(z.looseObject({ field: z.string() })).parse(body.errors).map((error) => error.field)).toEqual(['remarks']);
    expect(snapshot()).toEqual(before);
  });

  it('500 code points are accepted with spaces around them, and the stored text is trimmed', async () => {
    const accepted = await ignorePress({ remarks: `  ${'x'.repeat(IGNORE_REMARKS_MAX_LENGTH)}  ` });
    expect(accepted.status).toBe(200);
    expect(estimate().ignoreRemarks).toBe('x'.repeat(IGNORE_REMARKS_MAX_LENGTH));
  });
});

describe('AC-1, AC-4: every refusal is a 409 with its own code, and nothing is written', () => {
  it('a Quoted estimate cannot be ignored: 409 ESTIMATE_QUOTED_IS_FINAL', async () => {
    setStatus('QUOTED');
    const before = snapshot();
    const response = await ignorePress();
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: TRANSITION_REFUSALS.QUOTED_IS_FINAL.code, title: TRANSITION_REFUSALS.QUOTED_IS_FINAL.message });
    expect(snapshot()).toEqual(before);
  });

  it('a second Ignore: 409 ESTIMATE_ALREADY_IGNORED, no second entry, and the first remarks stay', async () => {
    expect((await ignorePress({ remarks: 'First remarks.' })).status).toBe(200);
    const first = snapshot();
    harness.signInAs('ADMIN');
    const again = await ignorePress({ remarks: 'Second remarks.' });
    expect(again.status).toBe(409);
    expect(await bodyOf(again)).toMatchObject({ code: TRANSITION_REFUSALS.ALREADY_IGNORED.code, title: TRANSITION_REFUSALS.ALREADY_IGNORED.message });
    expect(snapshot()).toEqual(first);
    expect(entries('estimate.ignored')).toHaveLength(1);
  });

  it('Restore of an estimate that is not ignored: 409 ESTIMATE_NOT_IGNORED', async () => {
    const before = snapshot();
    const response = await restorePress();
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: TRANSITION_REFUSALS.NOT_IGNORED.code, title: TRANSITION_REFUSALS.NOT_IGNORED.message });
    expect(snapshot()).toEqual(before);
    expect(entries('estimate.restored')).toEqual([]);
  });

  it('an estimate that does not exist is a 404 for both, and an ID that is none is a 404 too', async () => {
    expect((await IGNORE(post('ignore', { remarks: REMARKS }), withId(UNKNOWN_ESTIMATE_ID))).status).toBe(404);
    expect((await RESTORE(post('restore'), withId(UNKNOWN_ESTIMATE_ID))).status).toBe(404);
    expect((await IGNORE(post('ignore', { remarks: REMARKS }), withId('not-an-id'))).status).toBe(404);
    expect(harness.calculationAudit.rows).toEqual([]);
  });

  it('two Ignores at once leave exactly one layer and one entry: the second is the 409', async () => {
    const [first, second] = await Promise.all([ignorePress({ remarks: 'One.' }), ignorePress({ remarks: 'Two.' })]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(entries('estimate.ignored')).toHaveLength(1);
  });
});

describe('AC-4, AC-5: Restore clears the layer, has no body, and brings the status back', () => {
  it.each<EstimateStatus>(['DRAFT', 'PREPARED', 'APPROVED'])('a %s estimate: Ignore then Restore returns the same status; the answer is the status and nothing else', async (status) => {
    setStatus(status);
    expect((await ignorePress()).status).toBe(200);
    const response = await restorePress();
    expect(response.status).toBe(200);
    const answer = await bodyOf(response);
    expect(Object.keys(answer)).toEqual(['status']);
    expect(restoreAnswerSchema.parse(answer)).toEqual({ status });
    expect(estimate().status).toBe(status);
    expect(estimate().ignoredAt ?? null).toBeNull();
    expect(estimate().ignoreRemarks ?? null).toBeNull();
  });

  it('writes one entry, with the Ignore remarks before and the status after, and the person who restored', async () => {
    await ignorePress();
    harness.signInAs('ADMIN');
    expect((await restorePress()).status).toBe(200);
    expect(entries('estimate.restored')).toHaveLength(1);
    expect(defined(entries('estimate.restored')[0])).toMatchObject({ actorId: harness.idOf.ADMIN, objectId: owned(), before: { status: 'DRAFT', remarks: REMARKS }, after: { status: 'DRAFT' } });
  });

  it('takes no remarks of its own: a body that carries some is not read and writes nothing of it', async () => {
    await ignorePress();
    const response = await RESTORE(post('restore', { remarks: 'A reason of my own.' }), withId(owned()));
    expect([200, 422]).toContain(response.status);
    expect(JSON.stringify(entries('estimate.restored'))).not.toContain('A reason of my own.');
  });
});

describe('AC-1, AC-4: an Engineer is refused before the ID is looked at, and nobody signed in is 401', () => {
  it('an Engineer is the fixed 403 on both routes, for their own estimate and an invented ID alike, and nothing is written', async () => {
    harness.signInAs('ENGINEER');
    const before = snapshot();
    for (const press of [ignorePress, restorePress]) {
      const response = await press();
      expect(response.status).toBe(403);
      const recorded = { label: 'POST (API, Engineer)', url: ORIGIN, status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
      expect(fixedForbiddenProblem(recorded)).toBeNull();
    }
    expect((await IGNORE(post('ignore', { remarks: REMARKS }), withId(UNKNOWN_ESTIMATE_ID))).status).toBe(403);
    expect((await RESTORE(post('restore'), withId(UNKNOWN_ESTIMATE_ID))).status).toBe(403);
    expect(snapshot()).toEqual(before);
  });

  it('nobody signed in is 401', async () => {
    harness.signInAs(null);
    expect((await ignorePress()).status).toBe(401);
    expect((await restorePress()).status).toBe(401);
    expect(estimate().ignoredAt ?? null).toBeNull();
  });
});
