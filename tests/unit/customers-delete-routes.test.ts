import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { customerSide } from '../support/customer-audit-side';
import { CUSTOMER_CANARIES, CUSTOMER_CANARY_PHONE, CUSTOMER_RECIPE_ID } from '../support/customer-canary';
import { defined } from '../support/defined';
import { fakeCustomer } from '../support/fake-customers';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-02.07 (AC-1, AC-2, AC-4, AC-6) for `DELETE /api/v1/customers/{id}`, through the real `withRoute`, the real session and the real masters service over
 * in-memory storage: the answer of a delete that is allowed (204, no body, the customer leaves the list and the options, one `master.deleted` entry, the rates
 * stay), the answer of one that is refused (409 with the estimates named, the first ten and the count, and nothing written), the 404 and 422 of a bad ID, and
 * that the refusal carries no contact detail and no rate. The real storage, the row lock and the race are tested against PostgreSQL in
 * `tests/integration/masters/customer-delete.test.ts`. Who may call is `tests/security`. Every name and code is invented.
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
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getMastersService: () => shared.mastersService };
});

const ORIGIN = 'https://portal.example.test';
const ALPHA = CUSTOMER_RECIPE_ID;
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';

const { GET } = await import('@/app/api/v1/customers/route');
const { DELETE } = await import('@/app/api/v1/customers/[id]/route');
const { GET: GET_OPTIONS } = await import('@/app/api/v1/options/customers/route');

const record = z.record(z.string(), z.unknown());

function request(method: string, path = '/api/v1/customers'): Request {
  return new Request(`${ORIGIN}${path}`, { method, headers: { origin: ORIGIN } });
}

const withId = (id: string) => ({ params: Promise.resolve({ id }) });
const entriesSince = (count: number) => harness.auditWorld.audit.committed.slice(count);
const alpha = () => defined(harness.masters.customers.find((customer) => customer.id === ALPHA));

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ADMIN');
  // Every test starts from the canary customer and nothing else, whatever an earlier test did.
  harness.masters.customers.splice(
    0,
    harness.masters.customers.length,
    ...CUSTOMER_CANARIES.map((canary) => ({
      ...fakeCustomer(harness.masters.records, canary.name, Object.fromEntries(canary.rates.map((rate) => [rate.processItemId, rate.value])), { phone: canary.phone }),
      id: canary.id,
    })),
  );
});

describe('AC-1: a customer used by no estimate is soft-deleted', () => {
  it('answers 204 with no body, and the customer leaves the list and the estimate form\'s options', async () => {
    const response = await DELETE(request('DELETE'), withId(ALPHA));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const listed = z.array(record).parse(record.parse(await (await GET(request('GET'))).json())['customers']);
    expect(listed.map((customer) => customer['id'])).not.toContain(ALPHA);
    harness.signInAs('ENGINEER');
    const options = z.array(record).parse(record.parse(await (await GET_OPTIONS(request('GET', '/api/v1/options/customers'))).json())['options']);
    expect(options.map((option) => option['id'])).not.toContain(ALPHA);
  });

  it('keeps the customer\'s rates (it is a soft delete), and writes exactly one master.deleted entry with object_type customer', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const ratesBefore = [...alpha().values.entries()];
    expect((await DELETE(request('DELETE'), withId(ALPHA))).status).toBe(204);
    expect(alpha().deleted).toBe(true);
    expect([...alpha().values.entries()]).toEqual(ratesBefore);
    const entries = entriesSince(before);
    expect(entries.map((row) => [row.event, row.objectType, row.objectId, row.objectLabel])).toEqual([['master.deleted', 'customer', ALPHA, 'Canary-Customer-Alpha']]);
    expect(entries[0]?.after).toBeNull();
  });

  it('keeps in the entry the name, the names of the contact fields given and never their values, and every rate', async () => {
    const before = harness.auditWorld.audit.committed.length;
    await DELETE(request('DELETE'), withId(ALPHA));
    const entry = defined(entriesSince(before)[0]);
    const state = customerSide(entry.before);
    expect(state.name).toBe('Canary-Customer-Alpha');
    expect(state.contact).toEqual(['phone']);
    expect(state.rates).toHaveLength(15);
    expect(JSON.stringify(entry)).not.toContain(CUSTOMER_CANARY_PHONE);
  });
});

describe('AC-2: a customer on a Draft or Submitted estimate is refused', () => {
  it('answers 409 CUSTOMER_IN_USE naming the estimates, and changes nothing and writes no entry', async () => {
    alpha().openEstimates.push({ code: 'Q-2026-0101', status: 'DRAFT' }, { code: 'Q-2026-0102', status: 'SUBMITTED' });
    const before = harness.auditWorld.audit.committed.length;
    const response = await DELETE(request('DELETE'), withId(ALPHA));
    expect(response.status).toBe(409);
    expect(response.headers.get('Content-Type')).toBe('application/problem+json');
    const { requestId, ...body } = record.parse(await response.json());
    expect(requestId).toMatch(/^req-[0-9a-f]{8}$/);
    expect(body).toEqual({
      type: 'about:blank',
      title: 'Canary-Customer-Alpha cannot be deleted while an open estimate uses it',
      status: 409,
      code: 'CUSTOMER_IN_USE',
      estimates: [
        { code: 'Q-2026-0101', status: 'DRAFT' },
        { code: 'Q-2026-0102', status: 'SUBMITTED' },
      ],
      estimateTotal: 2,
    });
    expect(alpha().deleted).toBe(false);
    expect(harness.auditWorld.audit.committed).toHaveLength(before);
  });

  it('names the first ten estimates and counts the rest, so the screen can say "and N more"', async () => {
    for (let index = 0; index < 13; index += 1) alpha().openEstimates.push({ code: `Q-2026-${String(200 + index).padStart(4, '0')}`, status: 'DRAFT' });
    const body = record.parse(await (await DELETE(request('DELETE'), withId(ALPHA))).json());
    expect(z.array(record).parse(body['estimates'])).toHaveLength(10);
    expect(body['estimateTotal']).toBe(13);
  });

  it('carries no contact detail and no rate of the customer', async () => {
    alpha().openEstimates.push({ code: 'Q-2026-0101', status: 'DRAFT' });
    const text = await (await DELETE(request('DELETE'), withId(ALPHA))).text();
    for (const value of [CUSTOMER_CANARY_PHONE, '881.37', '882.37']) expect(text).not.toContain(value);
  });

  it('is allowed again once no open estimate has the customer (an estimate that is Approved does not count: AC-4)', async () => {
    alpha().openEstimates.push({ code: 'Q-2026-0101', status: 'DRAFT' });
    expect((await DELETE(request('DELETE'), withId(ALPHA))).status).toBe(409);
    alpha().openEstimates.length = 0;
    expect((await DELETE(request('DELETE'), withId(ALPHA))).status).toBe(204);
  });
});

describe('a bad ID', () => {
  it('answers 404 for an unknown ID and for one deleted already (nothing is written the second time), and 422 for one that is not a UUID', async () => {
    expect((await DELETE(request('DELETE'), withId(UNKNOWN_ID))).status).toBe(404);
    expect((await DELETE(request('DELETE'), withId(ALPHA))).status).toBe(204);
    const entries = harness.auditWorld.audit.committed.length;
    expect((await DELETE(request('DELETE'), withId(ALPHA))).status).toBe(404);
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
    expect((await DELETE(request('DELETE'), withId('not-an-id'))).status).toBe(422);
  });

  it('reads the ID in any letter case', async () => {
    expect((await DELETE(request('DELETE'), withId(ALPHA.toUpperCase()))).status).toBe(204);
  });
});

describe('AC-6: who may delete', () => {
  it.each([
    ['a Lead', 'LEAD', 403],
    ['an Engineer', 'ENGINEER', 403],
    ['nobody signed in', null, 401],
  ] as const)('%s gets %i and the customer stays', async (_who, role, status) => {
    harness.signInAs(role);
    const before = harness.auditWorld.audit.committed.length;
    expect((await DELETE(request('DELETE'), withId(ALPHA))).status).toBe(status);
    expect(alpha().deleted).toBe(false);
    expect(harness.auditWorld.audit.committed).toHaveLength(before);
  });
});
