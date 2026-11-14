import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { CUSTOMER_CANARIES, CUSTOMER_CANARY_PHONE, CUSTOMER_RECIPE_ID } from '../support/customer-canary';
import { defined } from '../support/defined';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-05.01 T5 (AC-3, AC-5, AC-6), through the real `withRoute`, the real session and the real estimate service over in-memory storage: what the body must
 * look like, what each refusal answers (404 the same for an estimate that is not the Engineer's and one that does not exist, 409, 422 under the field), that
 * a first choice and a change raise the revision and the same customer does not, and that the one strict answer carries an ID and a name of a customer and
 * nothing else, for every role. Who may call is `tests/security`. Every name and ID is invented.
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

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ENGINEER');
});

/** Puts the harness estimate back as the recipe made it, whatever a test did to it. */
afterEach(() => {
  const held = estimate();
  held.status = 'DRAFT';
  held.customerId = null;
  held.inputsRevision = 0;
  held.engineerId = harness.idOf.ENGINEER;
  for (const customer of harness.masters.customers) customer.deleted = false;
});

describe('AC-3: the Engineer chooses the customer of their own task', () => {
  it('answers 200 with the estimate, its status and the customer, stores it and raises the revision', async () => {
    const response = await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(owned()));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(record.parse(await response.json())).toEqual({ id: owned(), status: 'DRAFT', customer: { id: CUSTOMER_RECIPE_ID, name: defined(CUSTOMER_CANARIES[0]).name } });
    expect(estimate().customerId).toBe(CUSTOMER_RECIPE_ID);
    expect(estimate().inputsRevision).toBe(1);
  });

  it('the same customer again answers 200 and leaves the revision alone (AC-4)', async () => {
    await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(owned()));
    const again = await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(owned()));
    expect(again.status).toBe(200);
    expect(estimate().inputsRevision).toBe(1);
  });

  it('a Lead and an Admin may choose it on any draft, the Engineer\'s included', async () => {
    for (const role of ['LEAD', 'ADMIN'] as const) {
      harness.signInAs(role);
      expect((await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(owned()))).status).toBe(200);
    }
  });
});

describe('AC-5: the refusals', () => {
  it('another Engineer\'s estimate is the same 404 as one that does not exist, apart from the request ID', async () => {
    estimate().engineerId = harness.targetId;
    const notOwn = await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(owned()));
    const missing = await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(UNKNOWN_ID));
    const malformed = await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId('not-an-id'));
    expect([notOwn.status, missing.status, malformed.status]).toEqual([404, 404, 404]);
    const strip = async (response: Response) => {
      const { requestId, ...rest } = record.parse(await response.json());
      expect(requestId).toMatch(/^req-[0-9a-f]{8}$/);
      return rest;
    };
    const [a, b, c] = [await strip(notOwn), await strip(missing), await strip(malformed)];
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(estimate().customerId).toBeNull();
    expect(estimate().inputsRevision).toBe(0);
  });

  it.each(['SUBMITTED', 'APPROVED'] as const)('a %s estimate is 409 ESTIMATE_NOT_EDITABLE, and nothing changes', async (status) => {
    estimate().status = status;
    const response = await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(owned()));
    expect(response.status).toBe(409);
    expect(record.parse(await response.json())).toMatchObject({ code: 'ESTIMATE_NOT_EDITABLE', title: 'This estimate can no longer be changed.' });
    expect(estimate().customerId).toBeNull();
    expect(estimate().inputsRevision).toBe(0);
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
    defined(harness.masters.customers.find((customer) => customer.id === CUSTOMER_RECIPE_ID)).deleted = true;
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

describe('AC-6 (NFR-002): one strict answer, for every role, with no rate, cost or formula', () => {
  it.each(['ENGINEER', 'LEAD', 'ADMIN'] as const)('as %s the answer is exactly an ID, a status and a customer ID and name, and holds none of the customer rates or contact details', async (role) => {
    harness.signInAs(role);
    const response = await PUT(request({ customerId: CUSTOMER_RECIPE_ID }), withId(owned()));
    const body = record.parse(await response.json());
    expect(Object.keys(body).sort()).toEqual(['customer', 'id', 'status']);
    expect(Object.keys(record.parse(body['customer'])).sort()).toEqual(['id', 'name']);
    const text = JSON.stringify(body);
    for (const canary of CUSTOMER_CANARIES) for (const rate of canary.rates) expect(text).not.toContain(rate.value);
    expect(text).not.toContain(CUSTOMER_CANARY_PHONE);
  });
});
