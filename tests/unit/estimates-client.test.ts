import { describe, expect, it, vi } from 'vitest';

import { chooseCustomer, loadCustomerChoices } from '@/lib/estimates/estimates-client';

/**
 * STORY-05.01 T4 (AC-2, AC-3, AC-5), moved to SCR-06 by CR-01 item 6 (AQP-390): the browser's calls to the customers a Lead or an Admin chooses from (the assign context) and to "Set customer", and the
 * reading of their answers. `fetch` is replaced, so the test answers for the server. Every name and ID is invented.
 */

const ALPHA = { id: '00000000-0000-4000-8000-000000000c01', name: 'Brightwater Controls', shortName: 'BWC' };
const BETA = { id: '00000000-0000-4000-8000-000000000c02', name: 'Marlow Agro Systems', shortName: 'MAS' };
const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';

function answer(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } });
}

function fetching(response: Response | Error) {
  return vi.fn((...args: Parameters<typeof fetch>) => {
    void args;
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  });
}

describe('loadCustomerChoices (AC-2)', () => {
  it('reads the customers from GET /api/v1/options/assign-context, as an ID, a name and a short name each, and nothing else of the answer', async () => {
    const doFetch = fetching(answer({ engineers: [{ id: 'e1', name: 'Invented Engineer' }], customers: [ALPHA, BETA], alertsEnabled: true }));
    expect(await loadCustomerChoices(doFetch)).toEqual({ status: 'ok', value: [ALPHA, BETA] });
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/options/assign-context');
    expect(doFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', credentials: 'same-origin' });
  });

  it('an empty list is a list', async () => {
    expect(await loadCustomerChoices(fetching(answer({ engineers: [], customers: [], alertsEnabled: false })))).toEqual({ status: 'ok', value: [] });
  });

  it.each([
    ['a body that is not the answer', answer({ nope: true })],
    ['a customer without a name', answer({ customers: [{ id: ALPHA.id, shortName: 'BWC' }] })],
    ['a customer without a short name', answer({ customers: [{ id: ALPHA.id, name: ALPHA.name }] })],
    ['a customer with an empty ID', answer({ customers: [{ id: '', name: 'x', shortName: 'X' }] })],
    ['an entry that is not an object', answer({ customers: ['Brightwater'] })],
    ['the old list of the customers route', answer({ options: [{ id: ALPHA.id, name: ALPHA.name }] })],
    ['a body that is not JSON', new Response('<html>', { status: 200 })],
  ])('is "failed" for %s, never a list that might be wrong', async (_name, response) => {
    expect(await loadCustomerChoices(fetching(response))).toEqual({ status: 'failed' });
  });

  it('is "failed" when the network fails or the server faults', async () => {
    expect(await loadCustomerChoices(fetching(new Error('offline')))).toEqual({ status: 'failed' });
    expect(await loadCustomerChoices(fetching(answer({ code: 'INTERNAL_ERROR', title: 'x' }, 500)))).toEqual({ status: 'failed' });
  });
});

describe('chooseCustomer (AC-3, AC-5)', () => {
  it('sends PUT /api/v1/estimates/{id}/customer with the customer ID as JSON and reads the customer back', async () => {
    const doFetch = fetching(answer({ id: ESTIMATE, status: 'DRAFT', customer: ALPHA }));
    expect(await chooseCustomer(ESTIMATE, ALPHA.id, doFetch)).toEqual({ status: 'ok', value: ALPHA });
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/estimates/${ESTIMATE}/customer`);
    const init = doFetch.mock.calls[0]?.[1];
    expect(init).toMatchObject({ method: 'PUT', credentials: 'same-origin' });
    expect(JSON.parse(String(init?.body))).toEqual({ customerId: ALPHA.id });
  });

  it('puts an ID that is not safe in an address into it encoded', async () => {
    const doFetch = fetching(answer({ id: 'x', status: 'DRAFT', customer: ALPHA }));
    await chooseCustomer('a/b?c', ALPHA.id, doFetch);
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/estimates/a%2Fb%3Fc/customer');
  });

  it('a 422 comes back as a refusal with the message under customerId', async () => {
    const problem = { type: 'about:blank', title: 'x', status: 422, code: 'VALIDATION_FAILED', requestId: 'req-1', errors: [{ field: 'customerId', message: 'Choose a customer from the list.' }] };
    expect(await chooseCustomer(ESTIMATE, 'x', fetching(answer(problem, 422)))).toMatchObject({
      status: 'refused',
      httpStatus: 422,
      fields: { customerId: 'Choose a customer from the list.' },
    });
  });

  it('a 409 comes back as a refusal with the server\'s sentence as its title', async () => {
    const problem = { type: 'about:blank', title: 'This estimate can no longer be changed.', status: 409, code: 'ESTIMATE_NOT_EDITABLE', requestId: 'req-2' };
    expect(await chooseCustomer(ESTIMATE, ALPHA.id, fetching(answer(problem, 409)))).toMatchObject({
      status: 'refused',
      httpStatus: 409,
      code: 'ESTIMATE_NOT_EDITABLE',
      title: 'This estimate can no longer be changed.',
    });
  });

  it.each([
    ['an answer with no customer', answer({ id: ESTIMATE, status: 'DRAFT' })],
    ['an answer whose customer has no name', answer({ id: ESTIMATE, status: 'DRAFT', customer: { id: ALPHA.id } })],
    ['an answer that is not an object', answer('ok')],
  ])('is "failed" for %s', async (_name, response) => {
    expect(await chooseCustomer(ESTIMATE, ALPHA.id, fetching(response))).toEqual({ status: 'failed' });
  });

  it('is "failed" when the network fails', async () => {
    expect(await chooseCustomer(ESTIMATE, ALPHA.id, fetching(new Error('offline')))).toEqual({ status: 'failed' });
  });
});
