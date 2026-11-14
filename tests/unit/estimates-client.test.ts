import { describe, expect, it, vi } from 'vitest';

import { chooseCustomer, loadCustomerOptions } from '@/lib/estimates/estimates-client';

/**
 * STORY-05.01 T4 (AC-2, AC-3, AC-5): the browser's calls to the customer list and to "Set customer", and the reading of their answers. `fetch` is replaced, so the
 * test answers for the server. Every name and ID is invented.
 */

const ALPHA = { id: '00000000-0000-4000-8000-000000000c01', name: 'Brightwater Controls' };
const BETA = { id: '00000000-0000-4000-8000-000000000c02', name: 'Marlow Agro Systems' };
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

describe('loadCustomerOptions (AC-2)', () => {
  it('reads the list of customers from GET /api/v1/options/customers, as an ID and a name each', async () => {
    const doFetch = fetching(answer({ options: [ALPHA, BETA] }));
    expect(await loadCustomerOptions(doFetch)).toEqual({ status: 'ok', value: [ALPHA, BETA] });
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/options/customers');
    expect(doFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', credentials: 'same-origin' });
  });

  it('an empty list is a list', async () => {
    expect(await loadCustomerOptions(fetching(answer({ options: [] })))).toEqual({ status: 'ok', value: [] });
  });

  it.each([
    ['a body that is not the list', answer({ nope: true })],
    ['a customer without a name', answer({ options: [{ id: ALPHA.id }] })],
    ['a customer with an empty ID', answer({ options: [{ id: '', name: 'x' }] })],
    ['an entry that is not an object', answer({ options: ['Brightwater'] })],
    ['a body that is not JSON', new Response('<html>', { status: 200 })],
  ])('is "failed" for %s, never a list that might be wrong', async (_name, response) => {
    expect(await loadCustomerOptions(fetching(response))).toEqual({ status: 'failed' });
  });

  it('is "failed" when the network fails or the server faults', async () => {
    expect(await loadCustomerOptions(fetching(new Error('offline')))).toEqual({ status: 'failed' });
    expect(await loadCustomerOptions(fetching(answer({ code: 'INTERNAL_ERROR', title: 'x' }, 500)))).toEqual({ status: 'failed' });
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
