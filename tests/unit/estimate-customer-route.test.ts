import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { CUSTOMER_CANARIES, CUSTOMER_CANARY_PHONE, CUSTOMER_RECIPE_ID } from '../support/customer-canary';
import { defined } from '../support/defined';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-05.01 T5 (AC-3, AC-5, AC-6), changed by CR-01 item 6 (AQP-390, AC-7, AC-8, AC-13, AC-17), through the real `withRoute`, the real session and the real estimate service over in-memory storage: what the
 * body must look like, what each refusal answers, that a change raises the revision and the same customer does not, that a change writes one entry and the same customer none, and that the one strict answer
 * carries an ID, a name and a short name of a customer and nothing else. **Only a Lead and an Admin may change the customer**: an Engineer is 403 before the ID is looked at, the same for their own estimate, another's
 * and one that does not exist. Who may call is also `tests/security`. Every name and ID is invented.
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
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getEstimateService: () => shared.estimateService };
});

const ORIGIN = 'https://portal.example.test';
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';
const { PUT } = await import('@/app/api/v1/estimates/[id]/customer/route');

const record = z.record(z.string(), z.unknown());

function request(body?: unknown): Request {
  return new Request(`${ORIGIN}/api/v1/estimates/x/customer`, {
    method: 'PUT',
    headers: { origin: ORIGIN, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const withId = (id: string) => ({ params: Promise.resolve({ id }) });
const estimate = () => defined(harness.estimateWorld.estimates[0]);
const owned = (): string => estimate().id;
const canary = () => defined(harness.masters.customers.find((customer) => customer.id === CUSTOMER_RECIPE_ID));

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('LEAD');
});

/** Puts the harness estimate back as the recipe made it, whatever a test did to it. */
afterEach(() => {
  const held = estimate();
  held.status = 'DRAFT';
  held.customerId = null;
  held.inputsRevision = 0;
  held.engineerId = harness.idOf.ENGINEER;
  for (const customer of harness.masters.customers) customer.deleted = false;
  harness.estimateAudit.rows.length = 0;
});

describe('AC-3, AC-13: a Lead or an Admin changes the customer', () => {
  it.each(['LEAD', 'ADMIN'] as const)('as %s answers 200 with the estimate, its status and the customer with its short name, stores it and raises the revision', async (role) => {
    harness.signInAs(role);
    const response = await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(owned()));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(record.parse(await response.json())).toEqual({
      id: owned(),
      status: 'DRAFT',
      customer: { id: CUSTOMER_RECIPE_ID, name: defined(CUSTOMER_CANARIES[0]).name, shortName: canary().shortName },
    });
    expect(estimate().customerId).toBe(CUSTOMER_RECIPE_ID);
    expect(estimate().inputsRevision).toBe(1);
  });

  it('the same customer again answers 200 and leaves the revision alone (AC-13) and writes no entry', async () => {
    await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(owned()));
    harness.estimateAudit.rows.length = 0;
    const again = await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(owned()));
    expect(again.status).toBe(200);
    expect(estimate().inputsRevision).toBe(1);
    expect(harness.estimateAudit.rows).toHaveLength(0);
  });

  it('a prepared estimate may be changed by a Lead (their inputs); the estimate of another Engineer too', async () => {
    estimate().status = 'PREPARED';
    estimate().engineerId = harness.targetId;
    expect((await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(owned()))).status).toBe(200);
    expect(estimate().status).toBe('PREPARED');
  });
});

describe('AC-17: the audit entry', () => {
  it('a change writes one estimate.customer_changed entry by the signed-in person, about the task code, with the company names before and after', async () => {
    estimate().customerId = null;
    const response = await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(owned()));
    expect(response.status).toBe(200);
    expect(harness.estimateAudit.rows).toHaveLength(1);
    expect(harness.estimateAudit.rows[0]).toMatchObject({
      event: 'estimate.customer_changed',
      actorId: harness.idOf.LEAD,
      objectType: 'estimate',
      objectId: owned(),
      objectLabel: estimate().code,
      before: { customer: null },
      after: { customer: { name: defined(CUSTOMER_CANARIES[0]).name, shortName: canary().shortName } },
    });
    expect(harness.estimateAudit.rows[0]?.requestId).toMatch(/^req-[0-9a-f]{8}$/);
  });
});

describe('AC-7: the Engineer is refused, before the ID is looked at', () => {
  it('answers 403 for their own estimate, another Engineer\'s, an ID that does not exist and text that is no ID, with the same body apart from the request ID, and changes nothing', async () => {
    harness.signInAs('ENGINEER');
    const own = await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(owned()));
    estimate().engineerId = harness.targetId;
    const notOwn = await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(owned()));
    const missing = await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(UNKNOWN_ID));
    const malformed = await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId('not-an-id'));
    expect([own.status, notOwn.status, missing.status, malformed.status]).toEqual([403, 403, 403, 403]);
    const strip = async (response: Response) => {
      const { requestId, ...rest } = record.parse(await response.json());
      expect(requestId).toMatch(/^req-[0-9a-f]{8}$/);
      return rest;
    };
    const bodies = [await strip(own), await strip(notOwn), await strip(missing), await strip(malformed)];
    for (const body of bodies) expect(body).toEqual(bodies[0]);
    expect(estimate().customerId).toBeNull();
    expect(estimate().inputsRevision).toBe(0);
    expect(harness.estimateAudit.rows).toHaveLength(0);
  });

  it('is refused before the body is read: an Engineer sending a body that is not JSON, or has a stray key, still gets 403', async () => {
    harness.signInAs('ENGINEER');
    const notJson = new Request(`${ORIGIN}/api/v1/estimates/x/customer`, { method: 'PUT', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{' });
    expect((await PUT(notJson, withId(owned()))).status).toBe(403);
    expect((await PUT(request({ customerId: CUSTOMER_RECIPE_ID, inputsRevision: 99 }), withId(owned()))).status).toBe(403);
    expect(estimate().inputsRevision).toBe(0);
  });

  it('a signed-out caller is 401 and nothing changes', async () => {
    harness.signInAs(null);
    expect((await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(owned()))).status).toBe(401);
    expect(estimate().customerId).toBeNull();
  });
});

describe('AC-5, AC-7: the other refusals', () => {
  it('an estimate that does not exist and an ID that is no ID are the same 404 for a Lead, apart from the request ID', async () => {
    const missing = await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(UNKNOWN_ID));
    const malformed = await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId('not-an-id'));
    expect([missing.status, malformed.status]).toEqual([404, 404]);
    const strip = async (response: Response) => {
      const { requestId, ...rest } = record.parse(await response.json());
      expect(requestId).toMatch(/^req-[0-9a-f]{8}$/);
      return rest;
    };
    expect(await strip(missing)).toEqual(await strip(malformed));
  });

  it('an APPROVED estimate is 409 ESTIMATE_NOT_EDITABLE for a Lead and an Admin, and nothing changes', async () => {
    estimate().status = 'APPROVED';
    for (const role of ['LEAD', 'ADMIN'] as const) {
      harness.signInAs(role);
      const response = await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(owned()));
      expect(response.status).toBe(409);
      expect(record.parse(await response.json())).toMatchObject({ code: 'ESTIMATE_NOT_EDITABLE', title: 'This estimate can no longer be changed.' });
    }
    expect(estimate().customerId).toBeNull();
    expect(estimate().inputsRevision).toBe(0);
    expect(harness.estimateAudit.rows).toHaveLength(0);
  });

  it.each([
    ['a customer ID that does not exist', { customerId: UNKNOWN_ID }],
    ['text that is not an ID', { customerId: 'Brightwater Controls' }],
    ['no customer ID at all', {}],
  ])('%s is 422 under customerId, in the words of the form, and nothing changes', async (_name, body) => {
    const response = await PUT(request(body), withId(owned()));
    expect(response.status).toBe(422);
    const problem = record.parse(await response.json());
    expect(problem['errors']).toEqual([{ field: 'customerId', message: 'Choose a customer from the list.' }]);
    expect(estimate().inputsRevision).toBe(0);
  });

  it('a customer that was deleted is 422 too', async () => {
    canary().deleted = true;
    expect((await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(owned()))).status).toBe(422);
    expect(estimate().customerId).toBeNull();
  });

  it('a body with a key the route does not offer, and a body that is not JSON, are refused before anything is stored', async () => {
    expect((await PUT(request({ customerId: CUSTOMER_RECIPE_ID, inputsRevision: 99 }), withId(owned()))).status).toBe(422);
    const notJson = new Request(`${ORIGIN}/api/v1/estimates/x/customer`, { method: 'PUT', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{' });
    expect((await PUT(notJson, withId(owned()))).status).toBe(400);
    expect(estimate().inputsRevision).toBe(0);
  });
});

describe('AC-8 (NFR-002): one strict answer with no rate, cost or formula', () => {
  it.each(['LEAD', 'ADMIN'] as const)('as %s the answer is exactly an ID, a status and a customer ID, name and short name, and holds none of the customer rates or contact details', async (role) => {
    harness.signInAs(role);
    const response = await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(owned()));
    const body = record.parse(await response.json());
    expect(Object.keys(body).sort()).toEqual(['customer', 'id', 'status']);
    expect(Object.keys(record.parse(body['customer'])).sort()).toEqual(['id', 'name', 'shortName']);
    const text = JSON.stringify(body);
    for (const customer of CUSTOMER_CANARIES) for (const rate of customer.rates) expect(text).not.toContain(rate.value);
    expect(text).not.toContain(CUSTOMER_CANARY_PHONE);
  });
});
