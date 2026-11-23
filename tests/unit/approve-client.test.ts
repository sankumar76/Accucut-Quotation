import { describe, expect, it, vi } from 'vitest';

import { isPrice, MAX_REASON_LENGTH, PRICE_MESSAGE, prefillPrice, REASON_TOO_LONG_MESSAGE } from '@/lib/estimate/approve-price';
import { approveEstimate, canReadFigures } from '@/lib/estimates/approve-client';

/**
 * STORY-06.06 AC-1 (UX spec SCR-08 "Fields"): the price a Lead types and the browser's call to Approve and lock. `fetch` is replaced, so the test answers for the server. Nothing is read from a good answer but
 * that the estimate is APPROVED (the page is drawn again by the server, so no figure is kept); a refusal arrives with its code and the server's own sentence; an answer of the wrong shape is a failure, never a
 * success that might be wrong. Every name, ID and number is invented.
 */

const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const CALCULATION = '00000000-0000-4000-8000-0000000ca1c0';

const answer = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } });

function fetching(response: Response | Error) {
  return vi.fn((...args: Parameters<typeof fetch>) => {
    void args;
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  });
}

describe('the price field (AC-1)', () => {
  it.each(['0', '0.5', '12600', '12600.00', '12629.99', '999999999999.99', ' 12600.00 '])('%s is a price', (text) => {
    expect(isPrice(text)).toBe(true);
  });

  it.each(['', ' ', '-1', '12600.001', '12,600.00', '₹ 12600', '1e3', '12600.', '.5', 'abc', '1234567890123'])('"%s" is not a price, and the message is the spec\'s', (text) => {
    expect(isPrice(text)).toBe(false);
    expect(PRICE_MESSAGE).toBe('Enter a price in rupees, 0 or more, with up to 2 decimals.');
  });

  it('the field starts as the calculated total with two decimals (half away from zero), and empty when there is no total', () => {
    expect(prefillPrice('12629.99')).toBe('12629.99');
    expect(prefillPrice('12629.9876')).toBe('12629.99');
    expect(prefillPrice('12629.994')).toBe('12629.99');
    expect(prefillPrice('30')).toBe('30.00');
    expect(prefillPrice(null)).toBe('');
    expect(prefillPrice('not a number')).toBe('');
  });

  it('a reason is at most 500 characters, the limit the server holds it to', () => {
    expect(MAX_REASON_LENGTH).toBe(500);
  });
});

describe('approveEstimate', () => {
  it('sends POST /api/v1/estimates/{id}/approve with the calculation and the price only, and is ok when the status is APPROVED', async () => {
    const doFetch = fetching(answer({ status: 'APPROVED', approvedPrice: '12600.00', approvedAt: '2026-11-16T06:00:00.000Z' }));
    expect(await approveEstimate(ESTIMATE, { calculationId: CALCULATION, price: '12600.00' }, doFetch)).toEqual({ status: 'ok', value: true });
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/estimates/${ESTIMATE}/approve`);
    const init = doFetch.mock.calls[0]?.[1];
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(JSON.parse(String(init?.body))).toEqual({ calculationId: CALCULATION, price: '12600.00' });
  });

  it('encodes the estimate ID into the path', async () => {
    const doFetch = fetching(answer({ status: 'APPROVED' }));
    await approveEstimate('a/b c', { calculationId: CALCULATION, price: '1.00' }, doFetch);
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/estimates/a%2Fb%20c/approve');
  });

  it.each([
    ['a status that is not APPROVED', answer({ status: 'PREPARED' })],
    ['no status', answer({ approvedPrice: '1.00' })],
    ['a body that is not an object', answer('APPROVED')],
    ['a body that is not JSON', new Response('<html>', { status: 200 })],
    ['a server fault', answer({ code: 'INTERNAL', title: 'x' }, 500)],
  ])('is "failed" for %s', async (_name, response) => {
    expect(await approveEstimate(ESTIMATE, { calculationId: CALCULATION, price: '1.00' }, fetching(response))).toEqual({ status: 'failed' });
  });

  it('is "failed" when the network fails', async () => {
    expect(await approveEstimate(ESTIMATE, { calculationId: CALCULATION, price: '1.00' }, fetching(new Error('offline')))).toEqual({ status: 'failed' });
  });

  it.each([
    ['TOTALS_OUT_OF_DATE', 'An input changed since the last calculation. Press Recalculate first.'],
    ['CALCULATION_CHANGED', 'The figures were calculated again after this page was loaded, so nothing was approved. Show the new figures and check the total before you approve.'],
    ['ESTIMATE_ALREADY_APPROVED', 'This estimate has already been approved.'],
  ])('a 409 %s is a refusal with its code and the server\'s own sentence', async (code, title) => {
    const outcome = await approveEstimate(ESTIMATE, { calculationId: CALCULATION, price: '1.00' }, fetching(answer({ type: 'about:blank', title, status: 409, code }, 409)));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: 409, code, title });
  });

  it('a 422 names the field it refused, in the server\'s words', async () => {
    const body = { type: 'about:blank', title: 'Check the price.', status: 422, code: 'VALIDATION_FAILED', errors: [{ field: 'price', message: PRICE_MESSAGE }] };
    const outcome = await approveEstimate(ESTIMATE, { calculationId: CALCULATION, price: '1.234' }, fetching(answer(body, 422)));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: 422, fields: { price: PRICE_MESSAGE } });
  });

  it('STORY-06.07 AC-4: a 422 under `reason` reaches the dialog as the reason\'s own message, so it is shown under that field and the typed text is kept', async () => {
    const body = { type: 'about:blank', title: 'Use 500 characters or fewer.', status: 422, code: 'VALIDATION_FAILED', errors: [{ field: 'reason', message: REASON_TOO_LONG_MESSAGE }] };
    const outcome = await approveEstimate(ESTIMATE, { calculationId: CALCULATION, price: '1.00', reason: 'x'.repeat(501) }, fetching(answer(body, 422)));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: 422, fields: { reason: 'Use 500 characters or fewer.' } });
  });
});

describe('STORY-06.07: the reason travels with the request only when there is one', () => {
  const approved = () => fetching(answer({ status: 'APPROVED' }));

  it('is in the body, as typed, when the dialog sends one', async () => {
    const doFetch = approved();
    await approveEstimate(ESTIMATE, { calculationId: CALCULATION, price: '12600.00', reason: '  Rounded for the quote.  ' }, doFetch);
    expect(JSON.parse(String(doFetch.mock.calls[0]?.[1]?.body))).toEqual({ calculationId: CALCULATION, price: '12600.00', reason: '  Rounded for the quote.  ' });
  });

  it('is left out of the body, with no key at all, when the price is the calculated total (the request names the calculation and the price only)', async () => {
    const doFetch = approved();
    await approveEstimate(ESTIMATE, { calculationId: CALCULATION, price: '12629.99' }, doFetch);
    expect(Object.keys(JSON.parse(String(doFetch.mock.calls[0]?.[1]?.body)) as object).sort()).toEqual(['calculationId', 'price']);
  });
});

describe('canReadFigures (SCR-08 "Figures recalculated while open", "If the read fails")', () => {
  it('is true when the costs can be read, and keeps nothing of them', async () => {
    const doFetch = fetching(answer({ state: 'current', totals: { totalPrice: '917373.37' } }));
    expect(await canReadFigures(ESTIMATE, doFetch)).toBe(true);
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/estimates/${ESTIMATE}/costs`);
    expect(doFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', credentials: 'same-origin' });
  });

  it.each([
    ['a server fault', answer({ code: 'INTERNAL', title: 'x' }, 500)],
    ['a refusal', answer({ type: 'about:blank', title: 'No.', status: 403, code: 'FORBIDDEN' }, 403)],
    ['the network failing', new Error('offline')],
  ])('is false for %s', async (_name, response) => {
    expect(await canReadFigures(ESTIMATE, fetching(response))).toBe(false);
  });
});
