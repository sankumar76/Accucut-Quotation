import { describe, expect, it, vi } from 'vitest';

import { removePrice } from '@/lib/estimates/remove-price-client';
import { APPROVAL_NOT_CANCELLED_CODE, APPROVAL_NOT_CANCELLED_MESSAGE } from '@/lib/estimate/remove-price-words';
import { STEP_UP_FAILED_MESSAGE, STEP_UP_LOCKED_MESSAGE } from '@/lib/auth/step-up';

import { defined } from '../support/defined';

/**
 * STORY-06.13 AC-2, AC-4, AC-5, AC-7 (UX spec SCR-06 "Remove price (Admin)"): the browser's call of Remove price. `fetch` is replaced, so the test answers for the server. Nothing is read from a good removal but that the
 * answer carries a time (the page is drawn again by the server, so no figure is kept); a refusal arrives with its code and the server's own sentence; an answer of the wrong shape is a failure, never a success that might
 * be wrong. The password goes in the body of the one request and nowhere else. Every name, ID, number and password is invented.
 */

const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const APPROVAL = '00000000-0000-4000-8000-0000000a9901';
const PASSWORD = 'Invented-Client-Password-5!';
const INPUT = { approvalId: APPROVAL, password: PASSWORD };

const answer = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } });

function fetching(response: Response | Error) {
  return vi.fn((...args: Parameters<typeof fetch>) => {
    void args;
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  });
}

describe('removePrice', () => {
  it('sends POST /api/v1/estimates/{id}/approval/remove-price with the approval and the password, and is ok when the answer carries the time', async () => {
    const doFetch = fetching(answer({ removedAt: '2026-11-18T06:00:00.000Z' }));
    expect(await removePrice(ESTIMATE, INPUT, doFetch)).toEqual({ status: 'ok', value: true });
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/estimates/${ESTIMATE}/approval/remove-price`);
    const init = doFetch.mock.calls[0]?.[1];
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(JSON.parse(String(init?.body))).toEqual(INPUT);
  });

  it('puts the password in the body only: not in the address, a header or the query', async () => {
    const doFetch = fetching(answer({ removedAt: '2026-11-18T06:00:00.000Z' }));
    await removePrice(ESTIMATE, INPUT, doFetch);
    const [path, init] = defined(doFetch.mock.calls[0]);
    expect(String(path)).not.toContain(PASSWORD);
    expect(JSON.stringify(init?.headers)).not.toContain(PASSWORD);
    expect(String(init?.body)).toContain(PASSWORD);
  });

  it('encodes the estimate ID into the path', async () => {
    const doFetch = fetching(answer({ removedAt: '2026-11-18T06:00:00.000Z' }));
    await removePrice('a/b?c', INPUT, doFetch);
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/estimates/a%2Fb%3Fc/approval/remove-price');
  });

  it.each([
    ['a body with no time', answer({ status: 'DRAFT' })],
    ['a time that is not text', answer({ removedAt: 12 })],
    ['a body that is not an object', answer('removed')],
    ['a body that is not JSON', new Response('<html>', { status: 200 })],
    ['a server fault', answer({ code: 'INTERNAL', title: 'x' }, 500)],
  ])('is "failed" for %s: no usable answer, so the removal may have gone through', async (_name, response) => {
    expect(await removePrice(ESTIMATE, INPUT, fetching(response))).toEqual({ status: 'failed' });
  });

  it("carries a refusal with its code and the server's own sentence", async () => {
    const wrong = await removePrice(ESTIMATE, INPUT, fetching(answer({ type: 'about:blank', title: STEP_UP_FAILED_MESSAGE, status: 422, code: 'STEP_UP_FAILED' }, 422)));
    expect(wrong).toMatchObject({ status: 'refused', httpStatus: 422, code: 'STEP_UP_FAILED', title: STEP_UP_FAILED_MESSAGE });
    const locked = await removePrice(ESTIMATE, INPUT, fetching(answer({ type: 'about:blank', title: STEP_UP_LOCKED_MESSAGE, status: 429, code: 'STEP_UP_LOCKED' }, 429)));
    expect(locked).toMatchObject({ status: 'refused', httpStatus: 429, code: 'STEP_UP_LOCKED', title: STEP_UP_LOCKED_MESSAGE });
    const notCancelled = await removePrice(ESTIMATE, INPUT, fetching(answer({ type: 'about:blank', title: APPROVAL_NOT_CANCELLED_MESSAGE, status: 409, code: APPROVAL_NOT_CANCELLED_CODE }, 409)));
    expect(notCancelled).toMatchObject({ status: 'refused', httpStatus: 409, code: APPROVAL_NOT_CANCELLED_CODE, title: APPROVAL_NOT_CANCELLED_MESSAGE });
  });

  it('is "failed" when the network fails, and the failure holds nothing of what was sent', async () => {
    const outcome = await removePrice(ESTIMATE, INPUT, fetching(new Error('offline')));
    expect(outcome).toEqual({ status: 'failed' });
    expect(JSON.stringify(outcome)).not.toContain(PASSWORD);
  });
});
