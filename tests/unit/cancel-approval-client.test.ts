import { describe, expect, it, vi } from 'vitest';

import { cancelApproval } from '@/lib/estimates/cancel-approval-client';
import { CANCEL_CUSTOMER_DELETED_MESSAGE, CANCEL_REASON_TOO_LONG_MESSAGE } from '@/lib/estimate/cancel-words';
import { STEP_UP_FAILED_MESSAGE, STEP_UP_LOCKED_MESSAGE } from '@/lib/auth/step-up';

/**
 * STORY-06.12 AC-2, AC-4, AC-5, AC-7 (UX spec SCR-06 "Cancel approval (Admin)"): the browser's call of Cancel approval. `fetch` is replaced, so the test answers for the server. Nothing is read from a good cancel but
 * that the estimate is DRAFT or PREPARED (the page is drawn again by the server, so no figure is kept); a refusal arrives with its code and the server's own sentence; an answer of the wrong shape is a failure,
 * never a success that might be wrong. The password goes in the body of the one request and nowhere else. Every name, ID, number and password is invented.
 */

const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const APPROVAL = '00000000-0000-4000-8000-0000000a9901';
const PASSWORD = 'Invented-Client-Password-5!';
const INPUT = { approvalId: APPROVAL, reason: 'The wrong customer was priced.', password: PASSWORD };

const answer = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } });

function fetching(response: Response | Error) {
  return vi.fn((...args: Parameters<typeof fetch>) => {
    void args;
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  });
}

describe('cancelApproval', () => {
  it('sends POST /api/v1/estimates/{id}/approval/cancel with the approval, the reason and the password, and is ok when the status is DRAFT or PREPARED', async () => {
    for (const status of ['DRAFT', 'PREPARED']) {
      const doFetch = fetching(answer({ status, cancelledAt: '2026-11-17T06:00:00.000Z' }));
      expect(await cancelApproval(ESTIMATE, INPUT, doFetch)).toEqual({ status: 'ok', value: true });
      expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/estimates/${ESTIMATE}/approval/cancel`);
      const init = doFetch.mock.calls[0]?.[1];
      expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
      expect(JSON.parse(String(init?.body))).toEqual(INPUT);
    }
  });

  it('puts the password in the body only: not in the address, a header or the query', async () => {
    const doFetch = fetching(answer({ status: 'DRAFT' }));
    await cancelApproval(ESTIMATE, INPUT, doFetch);
    const [path, init] = defined(doFetch.mock.calls[0]);
    expect(String(path)).not.toContain(PASSWORD);
    expect(JSON.stringify(init?.headers)).not.toContain(PASSWORD);
    expect(String(init?.body)).toContain(PASSWORD);
  });

  it('encodes the estimate ID into the path', async () => {
    const doFetch = fetching(answer({ status: 'DRAFT' }));
    await cancelApproval('a/b c', INPUT, doFetch);
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/estimates/a%2Fb%20c/approval/cancel');
  });

  it.each([
    ['a status that is not DRAFT or PREPARED', answer({ status: 'APPROVED' })],
    ['no status', answer({ cancelledAt: '2026-11-17T06:00:00.000Z' })],
    ['a body that is not an object', answer('DRAFT')],
    ['a body that is not JSON', new Response('<html>', { status: 200 })],
    ['a server fault', answer({ code: 'INTERNAL', title: 'x' }, 500)],
  ])('is "failed" for %s: no usable answer, so the cancel may have gone through', async (_name, response) => {
    expect(await cancelApproval(ESTIMATE, INPUT, fetching(response))).toEqual({ status: 'failed' });
  });

  it('is "failed" when the network fails, and the failure holds nothing of what was sent', async () => {
    const outcome = await cancelApproval(ESTIMATE, INPUT, fetching(new Error('offline')));
    expect(outcome).toEqual({ status: 'failed' });
    expect(JSON.stringify(outcome)).not.toContain(PASSWORD);
  });

  it.each([
    [409, 'APPROVAL_CHANGED', 'This estimate has a newer approval than the one on your screen. Reload the page to see it.'],
    [409, 'APPROVAL_ALREADY_CANCELLED', 'This approval has already been cancelled.'],
    [409, 'NO_APPROVAL_TO_CANCEL', 'This estimate has no approval to cancel.'],
    [409, 'CUSTOMER_DELETED', CANCEL_CUSTOMER_DELETED_MESSAGE],
    [422, 'STEP_UP_FAILED', STEP_UP_FAILED_MESSAGE],
    [429, 'STEP_UP_LOCKED', STEP_UP_LOCKED_MESSAGE],
  ])('a %i %s is a refusal with its code and the server\'s own sentence', async (httpStatus, code, title) => {
    const outcome = await cancelApproval(ESTIMATE, INPUT, fetching(answer({ type: 'about:blank', title, status: httpStatus, code }, httpStatus)));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus, code, title });
  });

  it('a 422 under `reason` reaches the dialog as the reason\'s own message, so it is shown under that field and the typed text is kept', async () => {
    const body = { type: 'about:blank', title: CANCEL_REASON_TOO_LONG_MESSAGE, status: 422, code: 'VALIDATION_FAILED', errors: [{ field: 'reason', message: CANCEL_REASON_TOO_LONG_MESSAGE }] };
    const outcome = await cancelApproval(ESTIMATE, { ...INPUT, reason: 'x'.repeat(501) }, fetching(answer(body, 422)));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: 422, fields: { reason: 'Use 500 characters or fewer.' } });
  });
});

function defined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Expected a call.');
  return value;
}
