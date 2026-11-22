import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { CUSTOMER_CANARIES, CUSTOMER_CANARY_PHONE, CUSTOMER_RECIPE_ID } from '../../support/customer-canary';
import { defined } from '../../support/defined';
import { harness, holdSessionClock, releaseSessionClock } from '../../support/session-harness';

/**
 * CR-01 item 6 (AQP-390, AC-1, AC-5, AC-6, AC-8): `POST /api/v1/tasks` and `GET /api/v1/options/assign-context` through the real `withRoute`, the real session and the real task service over in-memory storage. The
 * body requires the customer, the subject and the title and refuses a key it does not offer (the short name is the master's, never typed); every problem is named at once, under the field; the answer carries the
 * customer's name and short name read from the master; the Engineer is refused before the body is read; the assign context carries the customers by ID, name and short name and nothing else. Every name is invented.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../../support/session-harness');
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getTaskService: () => shared.taskService };
});

const ORIGIN = 'https://portal.example.test';
const { POST } = await import('@/app/api/v1/tasks/route');
const { GET: ASSIGN_CONTEXT } = await import('@/app/api/v1/options/assign-context/route');

/** The harness holds one canary task and its estimate (the scan's recipe): the tests count what they add to it. */
const SEEDED_TASKS = harness.taskWorld.tasks.length;
const SEEDED_ESTIMATES = harness.taskWorld.estimates.length;

const record = z.record(z.string(), z.unknown());
const CUSTOMER = defined(CUSTOMER_CANARIES[0]);

const valid = () => ({
  engineerId: harness.idOf.ENGINEER,
  customerId: CUSTOMER_RECIPE_ID,
  folderPath: '\\\\invented-server\\invented-share\\RFQ-1',
  deadline: '2099-01-01T10:00',
  title: 'Hopper cover',
  subject: 'Feed hopper',
  notes: 'Invented notes.',
});

function request(path: string, method: string, body?: unknown): Request {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { origin: ORIGIN, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const post = (body?: unknown): Promise<Response> => POST(request('/api/v1/tasks', 'POST', body));
const messages = async (response: Response): Promise<Record<string, string>> =>
  Object.fromEntries(z.array(z.object({ field: z.string(), message: z.string() })).parse(record.parse(await response.json())['errors']).map((entry) => [entry.field, entry.message]));

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('LEAD');
});

afterEach(() => {
  harness.taskWorld.tasks.length = SEEDED_TASKS;
  harness.taskWorld.estimates.length = SEEDED_ESTIMATES;
  harness.taskWorld.sequences.clear();
  harness.taskWorld.deletedCustomers.clear();
});

describe('AC-5, AC-6: POST /api/v1/tasks with the customer, the subject and the title', () => {
  it.each(['LEAD', 'ADMIN'] as const)('as %s answers 201 with the task, its subject, the customer with the short name the master holds, and an estimate that already has the customer', async (role) => {
    harness.signInAs(role);
    const response = await post(valid());
    expect(response.status).toBe(201);
    const body = record.parse(await response.json());
    expect(body).toMatchObject({
      title: 'Hopper cover',
      subject: 'Feed hopper',
      customer: { id: CUSTOMER_RECIPE_ID, name: CUSTOMER.name, shortName: 'SHORT' },
      estimate: { status: 'DRAFT', customerId: CUSTOMER_RECIPE_ID },
    });
    expect(harness.taskWorld.tasks).toHaveLength(SEEDED_TASKS + 1);
    expect(harness.taskWorld.tasks.at(-1)).toMatchObject({ subject: 'Feed hopper', title: 'Hopper cover' });
    expect(harness.taskWorld.estimates.at(-1)).toMatchObject({ customerId: CUSTOMER_RECIPE_ID, status: 'DRAFT' });
  });

  it('the short name in the answer is the master\'s, whatever the request says: a body with a shortName key is refused (a strict body) and nothing is stored', async () => {
    harness.taskWorld.customerShortNames.set(CUSTOMER_RECIPE_ID, 'MASTER');
    expect(record.parse(await (await post(valid())).json())['customer']).toMatchObject({ shortName: 'MASTER' });
    harness.taskWorld.tasks.length = SEEDED_TASKS;
    harness.taskWorld.estimates.length = SEEDED_ESTIMATES;
    const refused = await post({ ...valid(), shortName: 'TYPED' });
    expect(refused.status).toBe(422);
    expect(harness.taskWorld.tasks).toHaveLength(SEEDED_TASKS);
    harness.taskWorld.customerShortNames.delete(CUSTOMER_RECIPE_ID);
  });

  it('names every problem at once, under its own field: the customer, the title and the subject are required', async () => {
    const response = await post({ engineerId: harness.idOf.ENGINEER, folderPath: valid().folderPath, deadline: valid().deadline });
    expect(response.status).toBe(422);
    expect(await messages(response)).toEqual({ customerId: 'Choose a customer.', title: 'Enter a title.', subject: 'Enter the subject.' });
    expect(harness.taskWorld.tasks).toHaveLength(SEEDED_TASKS);
  });

  it('refuses a subject over the limit with the number from the constant, and one with a line break', async () => {
    expect(await messages(await post({ ...valid(), subject: 'S'.repeat(81) }))).toEqual({ subject: 'Keep the subject under 80 characters.' });
    expect(await messages(await post({ ...valid(), subject: 'one\ntwo' }))).toEqual({ subject: 'Enter the subject on one line, without hidden characters.' });
    expect(await messages(await post({ ...valid(), subject: 'one\u200btwo' }))).toEqual({ subject: 'Enter the subject on one line, without hidden characters.' });
  });

  it.each([
    ['a customer that does not exist', '00000000-0000-4000-8000-00000000dead'],
    ['text that is not an ID', 'Brightwater Controls'],
  ])('%s is 422 under customerId, with the Engineer\'s problem too when there is one, and nothing is stored', async (_name, customerId) => {
    const response = await post({ ...valid(), customerId, engineerId: '00000000-0000-4000-8000-00000000dead' });
    expect(response.status).toBe(422);
    expect(await messages(response)).toEqual({ engineerId: 'Choose an Engineer.', customerId: 'Choose a customer.' });
    expect(harness.taskWorld.tasks).toHaveLength(SEEDED_TASKS);
  });

  it('a customer that was deleted is 422 under customerId too', async () => {
    harness.taskWorld.deletedCustomers.add(CUSTOMER_RECIPE_ID);
    expect(await messages(await post(valid()))).toEqual({ customerId: 'Choose a customer.' });
  });

  it('keeps the words of the browser\'s rules: the same module is spoken by the form and by the server', async () => {
    const response = await post({ ...valid(), title: 'T'.repeat(121) });
    expect(await messages(response)).toEqual({ title: 'Keep the title under 120 characters.' });
  });

  it('answers 403 to an Engineer and 401 to a signed-out caller, before the body is read', async () => {
    harness.signInAs('ENGINEER');
    expect((await post(valid())).status).toBe(403);
    expect((await post(undefined)).status).toBe(403);
    harness.signInAs(null);
    expect((await post(valid())).status).toBe(401);
    expect(harness.taskWorld.tasks).toHaveLength(SEEDED_TASKS);
  });
});

describe('AC-1, AC-8: GET /api/v1/options/assign-context', () => {
  it('carries the Engineers, the customers that are not deleted by ID, name and short name, and the one boolean of the settings, and nothing else of a customer', async () => {
    const response = await ASSIGN_CONTEXT(request('/api/v1/options/assign-context', 'GET'));
    expect(response.status).toBe(200);
    const body = record.parse(await response.json());
    expect(Object.keys(body).sort()).toEqual(['alertsEnabled', 'customers', 'engineers']);
    const customers = z.array(record).parse(body['customers']);
    expect(customers).toContainEqual({ id: CUSTOMER_RECIPE_ID, name: CUSTOMER.name, shortName: 'SHORT' });
    for (const customer of customers) expect(Object.keys(customer).sort()).toEqual(['id', 'name', 'shortName']);
    const text = JSON.stringify(body);
    for (const rate of CUSTOMER.rates) expect(text).not.toContain(rate.value);
    expect(text).not.toContain(CUSTOMER_CANARY_PHONE);
  });

  it('leaves a deleted customer out', async () => {
    harness.taskWorld.deletedCustomers.add(CUSTOMER_RECIPE_ID);
    const body = record.parse(await (await ASSIGN_CONTEXT(request('/api/v1/options/assign-context', 'GET'))).json());
    expect(z.array(record).parse(body['customers']).map((customer) => customer['id'])).not.toContain(CUSTOMER_RECIPE_ID);
  });

  it('is refused to an Engineer with 403, and to a signed-out caller with 401', async () => {
    harness.signInAs('ENGINEER');
    expect((await ASSIGN_CONTEXT(request('/api/v1/options/assign-context', 'GET'))).status).toBe(403);
    harness.signInAs(null);
    expect((await ASSIGN_CONTEXT(request('/api/v1/options/assign-context', 'GET'))).status).toBe(401);
  });
});
