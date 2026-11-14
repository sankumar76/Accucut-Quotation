import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { CALCULATE_MESSAGE } from '@/lib/estimate/calculate-words';
import { calculateAnswerSchema } from '@/server/views/schemas/estimates';

import { completePartInputs, fieldIdOf } from '../support/complete-part';
import { CUSTOMER_RECIPE_ID } from '../support/customer-canary';
import { defined } from '../support/defined';
import { MATERIAL_CANARIES } from '../support/material-master-canary';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-05.09 (AC-1, AC-2, AC-4, AC-6, AC-7; NFR-002; architecture section 6 "Calculate"), through the real `withRoute`, the real session and the real calculation service over in-memory
 * storage: the whole of a good answer is `{status, message}` with the fixed sentence, a blocked Calculate lists parts and field names and writes nothing, the refusals are the named ones, and
 * the answer does not change with what the masters hold. Who may call is `tests/security/role-matrix.test.ts`. Every name and ID is invented.
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
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getEstimateService: () => shared.estimateService, getCalculationService: () => shared.calculationService };
});

const ORIGIN = 'https://portal.example.test';
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';
const { POST } = await import('@/app/api/v1/estimates/[id]/calculate/route');

const record = z.record(z.string(), z.unknown());
const FIRST_MATERIAL = defined(MATERIAL_CANARIES[0]);

const request = (): Request => new Request(`${ORIGIN}/api/v1/estimates/x/calculate`, { method: 'POST', headers: { origin: ORIGIN } });
const withId = (id: string) => ({ params: Promise.resolve({ id }) });
const estimate = () => defined(harness.estimateWorld.estimates[0]);
const part = () => defined(harness.estimateWorld.nodes[0]);
const owned = (): string => estimate().id;

/** A complete estimate as the recipe's canary one is not: the customer chosen, and the one part holding every input, with a canary material. */
function makeComplete(): void {
  estimate().customerId = CUSTOMER_RECIPE_ID;
  part().inputs = { ...completePartInputs(), [fieldIdOf('material-in-drawing')]: FIRST_MATERIAL.id };
}

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ENGINEER');
});

/** Puts the harness estimate, its part and the stored records back as the recipe made them, whatever a test did. */
afterEach(() => {
  const held = estimate();
  held.status = 'DRAFT';
  held.customerId = null;
  held.inputsRevision = 0;
  held.engineerId = harness.idOf.ENGINEER;
  held.currentCalculationId = null;
  part().inputs = {};
  harness.calculationWorld.calculations.length = 0;
  for (const customer of harness.masters.customers) customer.deleted = false;
});

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return record.parse(await response.json());
}

describe('AC-2: a good Calculate answers exactly {status, message}', () => {
  it('is 200 with the status SUBMITTED and the fixed sentence, `no-store`, a request ID, and no other key', async () => {
    makeComplete();
    const response = await POST(request(), withId(owned()));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Request-Id')).toMatch(/^req-[0-9a-f]{8}$/);
    expect(await bodyOf(response)).toEqual({ status: 'SUBMITTED', message: CALCULATE_MESSAGE });
  });

  it('stores one record, submits the estimate and leaves the revision as it was', async () => {
    makeComplete();
    await POST(request(), withId(owned()));
    expect(harness.calculationWorld.calculations).toHaveLength(1);
    expect(estimate()).toMatchObject({ status: 'SUBMITTED', inputsRevision: 0 });
    expect(defined(harness.calculationWorld.calculations[0]).createdById).toBe(harness.idOf.ENGINEER);
  });

  it('the text of the answer holds no digit: nothing from the calculation, and no number of any kind', async () => {
    makeComplete();
    expect(await (await POST(request(), withId(owned()))).text()).not.toMatch(/\d/);
  });
});

describe('AC-6 (NFR-002): the answer is the same under any masters', () => {
  it('two sets of masters, one estimate: the same answer byte for byte, whatever the prices and rates are', async () => {
    makeComplete();
    const first = await (await POST(request(), withId(owned()))).text();
    // The Admin changes every price, rate and exchange rate; the estimate is a draft again (as a fresh one is) and is calculated again.
    for (const material of harness.masters.materials) material.pricePerKg = '1.23';
    for (const customer of harness.masters.customers) for (const key of customer.values.keys()) customer.values.set(key, '9.87');
    harness.masters.exchange.usd = '5.43';
    estimate().status = 'DRAFT';
    const second = await (await POST(request(), withId(owned()))).text();
    expect(second).toBe(first);
    const [one, two] = harness.calculationWorld.calculations;
    expect(defined(one).productValues).not.toEqual(defined(two).productValues);
  });
});

describe('AC-1: a blocked Calculate is the 422 that lists parts and field names, and writes nothing', () => {
  it('names each part with its Sl. No and name and each missing field by ID and label, under the sentence, and nothing else', async () => {
    makeComplete();
    part().inputs = { ...part().inputs, [fieldIdOf('cutting-time')]: '' };
    delete part().inputs[fieldIdOf('cutting-time')];
    const response = await POST(request(), withId(owned()));
    expect(response.status).toBe(422);
    expect(response.headers.get('Content-Type')).toBe('application/problem+json');
    const { requestId, ...body } = await bodyOf(response);
    expect(requestId).toMatch(/^req-[0-9a-f]{8}$/);
    expect(body).toEqual({
      type: 'about:blank',
      title: 'Nothing was submitted. 1 part has missing inputs.',
      status: 422,
      code: 'CALCULATE_BLOCKED',
      parts: [{ nodeId: part().id, slNo: '1', name: 'Invented text', fields: [{ fieldId: fieldIdOf('cutting-time'), label: 'Cutting Time' }] }],
    });
    expect(estimate().status).toBe('DRAFT');
    expect(harness.calculationWorld.calculations).toHaveLength(0);
  });

  it('an empty part lists every field it needs, and still no value and no figure', async () => {
    estimate().customerId = CUSTOMER_RECIPE_ID;
    const body = await bodyOf(await POST(request(), withId(owned())));
    const parts = z.array(record).parse(body['parts']);
    expect(parts).toHaveLength(1);
    // Only the words of the parts: a Sl. No, a name and labels. A canary price, gravity or scrap rate of the masters is nowhere in them.
    expect(JSON.stringify(parts.map((entry) => [entry['slNo'], entry['name'], entry['fields']]))).not.toMatch(/917373|737\.37|717\.37/);
  });
});

describe('AC-4 and AC-7: the refusals are named, and never a partial write', () => {
  it.each([
    ['no customer chosen', () => undefined, 'CUSTOMER_NOT_CHOSEN'],
    ['already submitted', () => (estimate().status = 'SUBMITTED'), 'ESTIMATE_ALREADY_SUBMITTED'],
    ['approved', () => (estimate().status = 'APPROVED'), 'ESTIMATE_APPROVED_IS_LOCKED'],
  ])('%s is a 409 with the code %s', async (_name, change, code) => {
    makeComplete();
    if (code === 'CUSTOMER_NOT_CHOSEN') estimate().customerId = null;
    change();
    const response = await POST(request(), withId(owned()));
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toMatchObject({ code, status: 409 });
    expect(harness.calculationWorld.calculations).toHaveLength(0);
  });

  it('a second press is the 409 and creates no second calculation', async () => {
    makeComplete();
    expect((await POST(request(), withId(owned()))).status).toBe(200);
    const again = await POST(request(), withId(owned()));
    expect(again.status).toBe(409);
    expect(await bodyOf(again)).toMatchObject({ code: 'ESTIMATE_ALREADY_SUBMITTED' });
    expect(harness.calculationWorld.calculations).toHaveLength(1);
  });

  it('another Engineer\'s estimate, one that does not exist and an ID that is none are the same 404, apart from the request ID', async () => {
    makeComplete();
    estimate().engineerId = harness.targetId;
    const notOwn = await POST(request(), withId(owned()));
    const missing = await POST(request(), withId(UNKNOWN_ID));
    const malformed = await POST(request(), withId('not-an-id'));
    expect([notOwn.status, missing.status, malformed.status]).toEqual([404, 404, 404]);
    const strip = async (response: Response) => {
      const { requestId, ...rest } = await bodyOf(response);
      expect(requestId).toMatch(/^req-[0-9a-f]{8}$/);
      return rest;
    };
    const [a, b, c] = [await strip(notOwn), await strip(missing), await strip(malformed)];
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(harness.calculationWorld.calculations).toHaveLength(0);
  });

  it('a customer or a material that the Admin deleted is the 409 with its own code, not a 404', async () => {
    makeComplete();
    defined(harness.masters.customers.find((customer) => customer.id === CUSTOMER_RECIPE_ID)).deleted = true;
    expect(await bodyOf(await POST(request(), withId(owned())))).toMatchObject({ status: 409, code: 'CUSTOMER_DELETED' });
    for (const customer of harness.masters.customers) customer.deleted = false;
    harness.masters.deletedMaterials.push(...harness.masters.materials.splice(harness.masters.materials.findIndex((material) => material.id === FIRST_MATERIAL.id), 1));
    expect(await bodyOf(await POST(request(), withId(owned())))).toMatchObject({ status: 409, code: 'MATERIAL_DELETED' });
    harness.masters.materials.push(...harness.masters.deletedMaterials.splice(0));
  });

  it.each(['LEAD', 'ADMIN'] as const)('a %s is refused 403 with the fixed body, before the estimate is looked at, and nothing is written', async (role) => {
    makeComplete();
    harness.signInAs(role);
    const response = await POST(request(), withId(owned()));
    expect(response.status).toBe(403);
    expect(await bodyOf(response)).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(harness.calculationWorld.calculations).toHaveLength(0);
    expect(estimate().status).toBe('DRAFT');
  });

  it('nobody signed in is 401', async () => {
    harness.signInAs(null);
    expect((await POST(request(), withId(owned()))).status).toBe(401);
  });
});

describe('the one schema of the answer holds the line (NFR-002)', () => {
  const good = { status: 'SUBMITTED', message: CALCULATE_MESSAGE };

  it('accepts exactly the good answer', () => {
    expect(calculateAnswerSchema.safeParse(good).success).toBe(true);
  });

  it.each([
    ['an extra key', { ...good, total: '917373.37' }],
    ['another status', { ...good, status: 'APPROVED' }],
    ['a message with a figure in it', { ...good, message: `${CALCULATE_MESSAGE} Total 917373.37` }],
    ['no message', { status: 'SUBMITTED' }],
    ['no status', { message: CALCULATE_MESSAGE }],
  ])('refuses %s, so it can never leave', (_name, answer) => {
    expect(calculateAnswerSchema.safeParse(answer).success).toBe(false);
  });
});
