import { describe, expect, it, vi } from 'vitest';

import { deleteCustomer } from '@/lib/masters/customers-client';
import { estimateUsesOf, statusWords, unnamedCount } from '@/lib/masters/estimate-uses';
import { inUseAdvice, inUseLead, inUseMore, inUseTitle } from '@/components/features/masters/master-texts';
import { customerDeletedNotice, customerGoneNotice, deleteCustomerDescription, deleteCustomerTitle } from '@/components/features/masters/customer-texts';

import { defined } from '../support/defined';

/**
 * STORY-02.07 (AC-2, AC-7): the browser's side of `DELETE /api/v1/customers/{id}` (the request, the 204, and the reading of the 409 that names the open
 * estimates) and the words of the delete dialogs. `fetch` is an argument, so each test answers for the server. Every name and code is invented.
 */

const ID = '00000000-0000-4000-8000-000800000c09';

function answer(status: number, body: unknown): typeof fetch {
  return vi.fn(() =>
    Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': status === 204 ? 'text/plain' : 'application/problem+json' } })),
  );
}

const IN_USE = {
  type: 'about:blank',
  title: 'Invented Works cannot be deleted while an open estimate uses it',
  status: 409,
  code: 'CUSTOMER_IN_USE',
  requestId: 'req-0a0b0c0d',
  estimates: [
    { code: 'Q-2026-0101', status: 'DRAFT' },
    { code: 'Q-2026-0102', status: 'SUBMITTED' },
  ],
  estimateTotal: 12,
};

describe('deleteCustomer', () => {
  it('sends DELETE to the customer\'s own address, encoding the ID, and reads the 204 as done', async () => {
    const doFetch = answer(204, null);
    expect(await deleteCustomer(ID, doFetch)).toEqual({ status: 'ok', value: true });
    expect(doFetch).toHaveBeenCalledWith(`/api/v1/customers/${ID}`, expect.objectContaining({ method: 'DELETE', credentials: 'same-origin' }));
    await deleteCustomer('a/b', doFetch);
    expect(doFetch).toHaveBeenLastCalledWith('/api/v1/customers/a%2Fb', expect.anything());
  });

  it('reads a 409 as a refusal with its code and the estimates it names', async () => {
    const outcome = await deleteCustomer(ID, answer(409, IN_USE));
    expect(outcome.status).toBe('refused');
    if (outcome.status !== 'refused') return;
    expect(outcome).toMatchObject({ httpStatus: 409, code: 'CUSTOMER_IN_USE' });
    expect(estimateUsesOf(outcome)).toEqual({ total: 12, estimates: IN_USE.estimates });
  });

  it('reads a 404 as a refusal, and a server fault or a network fault as failed', async () => {
    expect(await deleteCustomer(ID, answer(404, { type: 'about:blank', title: 'Customer not found.', status: 404, code: 'NOT_FOUND', requestId: 'req-0a0b0c0d' }))).toMatchObject({
      status: 'refused',
      httpStatus: 404,
    });
    expect(await deleteCustomer(ID, answer(500, { type: 'about:blank', title: 'Something went wrong on our side.', status: 500, code: 'INTERNAL_ERROR', requestId: 'req-0a0b0c0d' }))).toEqual({
      status: 'failed',
    });
    expect(await deleteCustomer(ID, vi.fn(() => Promise.reject(new Error('offline'))))).toEqual({ status: 'failed' });
  });
});

describe('estimateUsesOf: an answer of the wrong shape is never trusted', () => {
  const refusalWith = (body: Record<string, unknown>) => ({ status: 'refused' as const, httpStatus: 409, code: 'CUSTOMER_IN_USE', title: 't', fields: {}, body });

  it.each([
    ['no estimates member', { estimateTotal: 1 }],
    ['no total', { estimates: [] }],
    ['an estimate with an unknown status', { estimates: [{ code: 'Q-2026-0101', status: 'APPROVED' }], estimateTotal: 1 }],
    ['an estimate with no code', { estimates: [{ status: 'DRAFT' }], estimateTotal: 1 }],
    ['an estimate that is not an object', { estimates: ['Q-2026-0101'], estimateTotal: 1 }],
  ])('%s gives null', (_what, body) => {
    expect(estimateUsesOf(refusalWith(body))).toBeNull();
  });

  it('never gives a total below the number named', () => {
    expect(estimateUsesOf(refusalWith({ estimates: IN_USE.estimates, estimateTotal: 0 }))?.total).toBe(2);
  });

  it('counts the estimates that are not named, and says a status in words', () => {
    const uses = defined(estimateUsesOf(refusalWith({ estimates: IN_USE.estimates, estimateTotal: 12 })));
    expect(unnamedCount(uses)).toBe(10);
    expect(statusWords('DRAFT')).toBe('Draft');
    expect(statusWords('SUBMITTED')).toBe('Submitted');
  });
});

describe('the words of the delete dialogs (ux-spec SCR-12, the mock-up)', () => {
  it('the confirmation says what leaves, what stays and that it cannot be undone here', () => {
    expect(deleteCustomerTitle('Invented Works')).toBe('Delete Invented Works?');
    expect(deleteCustomerDescription('Invented Works')).toBe(
      'Invented Works no longer appears in this list or in the customer choice on new estimates. Estimates that are already calculated keep their figures. You cannot undo this here.',
    );
  });

  it('the refusal names the customer, counts the estimates and says what to do first, in the singular and the plural', () => {
    expect(inUseTitle('Invented Works')).toBe('Invented Works cannot be deleted yet');
    expect(inUseLead('customer', 1)).toBe('An open estimate uses this customer:');
    expect(inUseLead('customer', 12)).toBe('12 open estimates use this customer:');
    expect(inUseMore(2)).toBe('and 2 more');
    expect(inUseAdvice('customer', 1)).toBe('Approve it, or move it to another customer, and then delete this one.');
    expect(inUseAdvice('customer', 3)).toBe('Approve them, or move them to another customer, and then delete this one.');
    expect(inUseAdvice('material', 1)).toBe('Approve it, or change the material on its parts, and then delete this one.');
    expect(inUseAdvice('material', 3)).toBe('Approve them, or change the material on their parts, and then delete this one.');
  });

  it('the notices after a delete and after a delete that was already done elsewhere', () => {
    expect(customerDeletedNotice('Invented Works')).toEqual({ tone: 'success', text: 'Invented Works was deleted. The change is in the audit log.' });
    expect(customerGoneNotice('Invented Works')).toMatchObject({ tone: 'info', title: 'Invented Works was already deleted.' });
  });
});
