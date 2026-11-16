import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { RecalculateButton } from '@/components/features/estimate-recalculate/recalculate-button';
import { recalculateEstimate } from '@/lib/estimates/recalculate-client';

/**
 * STORY-06.04 (AC-3, AC-5, AC-9; NFR-002): the browser's call to Recalculate and the one control that makes it. `fetch` is replaced, so the test answers for the server. The only thing read from a good
 * answer is that its state is `current`: no figure is kept (the page is drawn again by the server). An answer of the wrong shape is a failure, never a success that might be wrong. The control's own
 * draw is checked as markup (its press is an end-to-end test, `tests/e2e/estimate-cleared.spec.ts`). Every name and ID is invented.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';

const answer = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } });

function fetching(response: Response | Error) {
  return vi.fn((...args: Parameters<typeof fetch>) => {
    void args;
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  });
}

describe('recalculateEstimate', () => {
  it('sends POST /api/v1/estimates/{id}/recalculate with no body, and is ok when the state is current, keeping nothing else of the answer', async () => {
    const doFetch = fetching(answer({ state: 'current', totals: { totalPrice: '917373.37' }, nodes: [] }));
    expect(await recalculateEstimate(ESTIMATE, doFetch)).toEqual({ status: 'ok', value: true });
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/estimates/${ESTIMATE}/recalculate`);
    const init = doFetch.mock.calls[0]?.[1];
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(init?.body).toBeUndefined();
  });

  it('encodes the estimate ID into the path', async () => {
    const doFetch = fetching(answer({ state: 'current' }));
    await recalculateEstimate('a/b c', doFetch);
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/estimates/a%2Fb%20c/recalculate');
  });

  it.each([
    ['a state that is not current', answer({ state: 'out-of-date' })],
    ['no state', answer({ totals: null })],
    ['a body that is not an object', answer('current')],
    ['a body that is not JSON', new Response('<html>', { status: 200 })],
  ])('is "failed" for %s', async (_name, response) => {
    expect(await recalculateEstimate(ESTIMATE, fetching(response))).toEqual({ status: 'failed' });
  });

  it('is "failed" when the network fails or the server faults', async () => {
    expect(await recalculateEstimate(ESTIMATE, fetching(new Error('offline')))).toEqual({ status: 'failed' });
    expect(await recalculateEstimate(ESTIMATE, fetching(answer({ code: 'INTERNAL_ERROR', title: 'x' }, 500)))).toEqual({ status: 'failed' });
  });

  it.each([
    ['an approved estimate', 'ESTIMATE_APPROVED_IS_LOCKED', 'This estimate is approved and locked. Unlock it first.', 409],
    ['a 0 in QTY per Assy', 'CALCULATE_ACK_REQUIRED', 'Check the quantity before you calculate.', 409],
    ['a blank input', 'CALCULATE_BLOCKED', 'Nothing was submitted. 1 part has missing inputs.', 422],
  ])('a refusal for %s keeps the server\'s code and words', async (_name, code, title, status) => {
    const outcome = await recalculateEstimate(ESTIMATE, fetching(answer({ type: 'about:blank', title, status, code, requestId: 'req-00000000' }, status)));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: status, code, title });
  });
});

describe('the control as drawn', () => {
  const draw = (label: string): string =>
    renderToStaticMarkup(createElement(RecalculateButton, { id: 'review-calculate', estimateId: ESTIMATE, label, busyLine: 'Calculating. This takes a moment.', failedLine: 'We could not calculate this estimate.' }));

  it('is one enabled button with the label it is given, not busy, with a polite line that is hidden until it has something to say, and no notice', () => {
    const html = draw('Recalculate');
    expect(html).toMatch(/<button[^>]*aria-busy="false"[^>]*id="review-calculate"[^>]*>Recalculate<\/button>/);
    expect(html).not.toContain('disabled=""');
    expect(html).toMatch(/<p aria-live="polite" class="sr-only"><\/p>/);
    expect(html).not.toContain('role="alert"');
  });

  it('carries no figure, no estimate ID and no request: the ID is a prop of the click handler, not in the markup', () => {
    const html = draw('Calculate');
    expect(html).not.toContain(ESTIMATE);
    expect(html).not.toMatch(/\d+\.\d\d/);
  });
});
