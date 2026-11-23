import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { TRANSITION_REFUSALS, type EstimateStatus } from '@/lib/estimate/state-machine';
import { markQuotedAnswerSchema } from '@/server/views/schemas/estimates';

import { defined } from '../support/defined';
import { fixedForbiddenProblem } from '../support/scanner';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * CR-01 item 7C, AC-2, AC-3, AC-7 and AC-8 (AQP-400; FR-110; NFR-001, NFR-002, NFR-007; architecture section 4.12 c), through the real `withRoute`, the real session and the real estimate status and estimate services over
 * in-memory storage: a Lead or an Admin marks an APPROVED estimate as quoted, and the answer is the new status and the marker (a time and a name) and nothing else; a second press, a Draft or Prepared estimate and an
 * ignored one (whatever its status underneath) are each their own 409 and write no status and no audit entry; an Engineer is the fixed 403 before the ID is looked at, and nobody signed in is 401; a body cannot change
 * what is written; two presses at once leave exactly one entry. Who may call the route is `tests/security/role-matrix.test.ts`; the PostgreSQL side (the row lock, the CHECKs, the unlock and cancel from QUOTED) is
 * `tests/integration/estimates/mark-quoted.test.ts`. Every name, ID and number is invented.
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
const { POST } = await import('@/app/api/v1/estimates/[id]/quoted/route');

const record = z.record(z.string(), z.unknown());

const post = (body?: unknown, origin: string = ORIGIN): Request =>
  body === undefined
    ? new Request(`${ORIGIN}/api/v1/estimates/x/quoted`, { method: 'POST', headers: { origin } })
    : new Request(`${ORIGIN}/api/v1/estimates/x/quoted`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const withId = (id: string) => ({ params: Promise.resolve({ id }) });
const estimate = () => defined(harness.estimateWorld.estimates[0]);
const owned = (): string => estimate().id;
const bodyOf = async (response: Response): Promise<Record<string, unknown>> => record.parse(await response.json());
const press = (body?: unknown): Promise<Response> => POST(post(body), withId(owned()));
const quotedEntries = () => harness.calculationAudit.rows.filter((row) => row.event === 'estimate.quoted');

/** The recipe's estimate (a Draft) in the given status, ignored or not. */
function setStatus(status: EstimateStatus, ignored = false): void {
  estimate().status = status;
  if (ignored) estimate().ignoredAt = new Date('2026-11-20T10:00:00.000Z');
}

/** What a refusal must have left alone: the status, the marker, the layer and the audit entries. */
function snapshot() {
  return { status: estimate().status, quotedBy: estimate().quotedBy ?? null, ignoredAt: estimate().ignoredAt ?? null, audit: harness.calculationAudit.rows.length };
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
  harness.calculationAudit.rows.length = 0;
  vi.restoreAllMocks();
});

describe('AC-2, AC-7: a good mark writes the status, the marker and one audit entry together', () => {
  it.each([
    ['LEAD', () => harness.idOf.LEAD, 'Invented Lead'],
    ['ADMIN', () => harness.idOf.ADMIN, 'Invented Admin'],
  ] as const)('%s: 200 with the status QUOTED and the marker and nothing else; the estimate is QUOTED with the person recorded; one entry', async (role, personId, label) => {
    harness.signInAs(role);
    setStatus('APPROVED');
    const response = await press();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const answer = await bodyOf(response);
    expect(Object.keys(answer).sort()).toEqual(['quoted', 'status']);
    expect(Object.keys(record.parse(answer['quoted'])).sort()).toEqual(['at', 'byName']);
    expect(markQuotedAnswerSchema.parse(answer)).toMatchObject({ status: 'QUOTED' });
    expect(estimate()).toMatchObject({ status: 'QUOTED', quotedBy: personId() });
    expect(quotedEntries()).toHaveLength(1);
    expect(defined(quotedEntries()[0])).toMatchObject({ actorId: personId(), actorLabel: label, objectId: owned(), before: { status: 'APPROVED' }, after: { status: 'QUOTED' } });
  });

  it('the body cannot change what is written: a body that names a status, a person or a time is ignored, and the person is the signed-in one', async () => {
    setStatus('APPROVED');
    const response = await press({ status: 'APPROVED', quotedBy: 'someone-else', quotedAt: '2020-01-01T00:00:00.000Z' });
    expect(response.status).toBe(200);
    expect(estimate()).toMatchObject({ status: 'QUOTED', quotedBy: harness.idOf.LEAD });
    expect(JSON.stringify(await bodyOf(response))).not.toMatch(/someone-else|2020-01-01/);
  });

  it('an audit entry that cannot be written takes the mark and the status with it', async () => {
    setStatus('APPROVED');
    const before = snapshot();
    vi.spyOn(harness.calculationAudit.service, 'record').mockRejectedValueOnce(new Error('Invented audit failure.'));
    expect((await press()).status).toBe(500);
    expect(snapshot()).toEqual(before);
    expect(estimate().status).toBe('APPROVED');
  });

  it('a request from another origin is refused before anything else, and the estimate is as it was', async () => {
    setStatus('APPROVED');
    const elsewhere = await POST(post(undefined, 'https://elsewhere.example.test'), withId(owned()));
    expect(elsewhere.status).toBe(403);
    expect(await bodyOf(elsewhere)).toMatchObject({ code: 'ORIGIN_REFUSED' });
    expect(estimate().status).toBe('APPROVED');
  });
});

describe('AC-3: every refusal is a 409 with its own code, and nothing is written', () => {
  it('a second press: 409 ESTIMATE_ALREADY_QUOTED, no second entry, and the first marker stays', async () => {
    setStatus('APPROVED');
    expect((await press()).status).toBe(200);
    const first = snapshot();
    harness.signInAs('ADMIN');
    const again = await press();
    expect(again.status).toBe(409);
    expect(await bodyOf(again)).toMatchObject({ code: TRANSITION_REFUSALS.ALREADY_QUOTED.code, title: TRANSITION_REFUSALS.ALREADY_QUOTED.message });
    expect(snapshot()).toEqual(first);
    expect(quotedEntries()).toHaveLength(1);
  });

  it.each<EstimateStatus>(['DRAFT', 'PREPARED'])('a %s estimate: 409 ESTIMATE_NOT_APPROVED', async (status) => {
    setStatus(status);
    const before = snapshot();
    const response = await press();
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: TRANSITION_REFUSALS.NOT_APPROVED.code, title: TRANSITION_REFUSALS.NOT_APPROVED.message });
    expect(snapshot()).toEqual(before);
  });

  it.each<EstimateStatus>(['APPROVED', 'DRAFT', 'PREPARED'])('an ignored %s estimate: 409 ESTIMATE_IGNORED, whatever its status (an ignored Draft or Prepared one is not "not approved")', async (status) => {
    setStatus(status, true);
    const before = snapshot();
    const response = await press();
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code: TRANSITION_REFUSALS.IGNORED.code, title: TRANSITION_REFUSALS.IGNORED.message });
    expect(snapshot()).toEqual(before);
    expect(quotedEntries()).toEqual([]);
  });

  it('an estimate that does not exist is a 404, and an ID that is none is a 404 too', async () => {
    expect((await POST(post(), withId(UNKNOWN_ESTIMATE_ID))).status).toBe(404);
    expect((await POST(post(), withId('not-an-id'))).status).toBe(404);
    expect(quotedEntries()).toEqual([]);
  });

  it('two presses at once leave exactly one mark and one entry: the second is the 409', async () => {
    setStatus('APPROVED');
    const [first, second] = await Promise.all([press(), press()]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(quotedEntries()).toHaveLength(1);
    expect(estimate().status).toBe('QUOTED');
  });
});

describe('AC-2: an Engineer is refused before the ID is looked at, and nobody signed in is 401', () => {
  it('an Engineer is the fixed 403 for their own estimate, for a Quoted-able one and for an invented ID alike, and nothing is written', async () => {
    harness.signInAs('ENGINEER');
    setStatus('APPROVED');
    const before = snapshot();
    const response = await press();
    expect(response.status).toBe(403);
    const recorded = { label: 'POST quoted (API, Engineer)', url: ORIGIN, status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
    expect(fixedForbiddenProblem(recorded)).toBeNull();
    expect((await POST(post(), withId(UNKNOWN_ESTIMATE_ID))).status).toBe(403);
    expect(snapshot()).toEqual(before);
  });

  it('nobody signed in is 401', async () => {
    setStatus('APPROVED');
    harness.signInAs(null);
    expect((await press()).status).toBe(401);
    expect(estimate().status).toBe('APPROVED');
  });
});
