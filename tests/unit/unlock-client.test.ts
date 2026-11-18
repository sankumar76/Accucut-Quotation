import { describe, expect, it, vi } from 'vitest';

import { UNLOCK_CUSTOMER_DELETED_MESSAGE, UNLOCK_REASON_TOO_LONG_MESSAGE } from '@/lib/estimate/unlock-words';
import { readUnlockPreview, unlockEstimate } from '@/lib/estimates/unlock-client';

/**
 * STORY-06.08 AC-1, AC-4, AC-5 (UX spec SCR-09 "Fields", "States"): the browser's two calls of Unlock, the preview and the unlock. `fetch` is replaced, so the test answers for the server. Nothing is read from a
 * good unlock but that the estimate is DRAFT (the page is drawn again by the server, so no figure is kept); a refusal arrives with its code and the server's own sentence; an answer of the wrong shape is a
 * failure, never a success that might be wrong. Every name, ID and number is invented.
 */

const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const PREVIEW = { engineerName: 'Invented Engineer', configuration: { approved: 7, current: 9 }, changed: { processRates: 1, materialPrices: 2, exchangeRates: 0 } };

const answer = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } });

function fetching(response: Response | Error) {
  return vi.fn((...args: Parameters<typeof fetch>) => {
    void args;
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  });
}

describe('readUnlockPreview (AC-1)', () => {
  it('sends GET /api/v1/estimates/{id}/unlock-preview and returns the Engineer, the two version numbers and the three counts', async () => {
    const doFetch = fetching(answer(PREVIEW));
    expect(await readUnlockPreview(ESTIMATE, doFetch)).toEqual({ status: 'ok', value: PREVIEW });
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/estimates/${ESTIMATE}/unlock-preview`);
    expect(doFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', credentials: 'same-origin' });
  });

  it('keeps nothing the answer holds beyond the shape it promises (a key that is not named is dropped)', async () => {
    const outcome = await readUnlockPreview(ESTIMATE, fetching(answer({ ...PREVIEW, rate: 'PLANTED-12.5' })));
    expect(outcome).toEqual({ status: 'ok', value: PREVIEW });
  });

  it('encodes the estimate ID into the path', async () => {
    const doFetch = fetching(answer(PREVIEW));
    await readUnlockPreview('a/b c', doFetch);
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/estimates/a%2Fb%20c/unlock-preview');
  });

  it.each([
    ['no Engineer', { ...PREVIEW, engineerName: '' }],
    ['a count that is negative', { ...PREVIEW, changed: { ...PREVIEW.changed, processRates: -1 } }],
    ['a count that is not a whole number', { ...PREVIEW, changed: { ...PREVIEW.changed, materialPrices: 1.5 } }],
    ['a count that is text', { ...PREVIEW, changed: { ...PREVIEW.changed, exchangeRates: '1' } }],
    ['no configuration versions', { engineerName: 'Invented Engineer', changed: PREVIEW.changed }],
    ['a version that is not a number', { ...PREVIEW, configuration: { approved: '7', current: 9 } }],
    ['no counts', { engineerName: 'Invented Engineer', configuration: PREVIEW.configuration }],
    ['a body that is not an object', 'Q'],
  ])('is "failed" for %s', async (_name, body) => {
    expect(await readUnlockPreview(ESTIMATE, fetching(answer(body)))).toEqual({ status: 'failed' });
  });

  it('is "failed" for a server fault, a body that is not JSON, and the network failing', async () => {
    expect(await readUnlockPreview(ESTIMATE, fetching(answer({ code: 'INTERNAL', title: 'x' }, 500)))).toEqual({ status: 'failed' });
    expect(await readUnlockPreview(ESTIMATE, fetching(new Response('<html>', { status: 200 })))).toEqual({ status: 'failed' });
    expect(await readUnlockPreview(ESTIMATE, fetching(new Error('offline')))).toEqual({ status: 'failed' });
  });

  it('a 409 CUSTOMER_DELETED is a refusal with its code and the server\'s own sentence, so the dialog can stop before the reason is typed', async () => {
    const body = { type: 'about:blank', title: UNLOCK_CUSTOMER_DELETED_MESSAGE, status: 409, code: 'CUSTOMER_DELETED' };
    expect(await readUnlockPreview(ESTIMATE, fetching(answer(body, 409)))).toMatchObject({ status: 'refused', httpStatus: 409, code: 'CUSTOMER_DELETED', title: UNLOCK_CUSTOMER_DELETED_MESSAGE });
  });
});

describe('unlockEstimate (AC-2, AC-4, AC-5)', () => {
  it('sends POST /api/v1/estimates/{id}/unlock with the reason only, and is ok when the status is DRAFT', async () => {
    const doFetch = fetching(answer({ status: 'DRAFT', unlockedAt: '2026-11-17T06:00:00.000Z' }));
    expect(await unlockEstimate(ESTIMATE, 'The customer asked for a new fixture.', doFetch)).toEqual({ status: 'ok', value: true });
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/estimates/${ESTIMATE}/unlock`);
    const init = doFetch.mock.calls[0]?.[1];
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(JSON.parse(String(init?.body))).toEqual({ reason: 'The customer asked for a new fixture.' });
  });

  it('encodes the estimate ID into the path', async () => {
    const doFetch = fetching(answer({ status: 'DRAFT' }));
    await unlockEstimate('a/b c', 'Reason.', doFetch);
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/estimates/a%2Fb%20c/unlock');
  });

  it.each([
    ['a status that is not DRAFT', answer({ status: 'APPROVED' })],
    ['no status', answer({ unlockedAt: '2026-11-17T06:00:00.000Z' })],
    ['a body that is not an object', answer('DRAFT')],
    ['a body that is not JSON', new Response('<html>', { status: 200 })],
    ['a server fault', answer({ code: 'INTERNAL', title: 'x' }, 500)],
  ])('is "failed" for %s: no usable answer, so the unlock may have gone through', async (_name, response) => {
    expect(await unlockEstimate(ESTIMATE, 'Reason.', fetching(response))).toEqual({ status: 'failed' });
  });

  it('is "failed" when the network fails', async () => {
    expect(await unlockEstimate(ESTIMATE, 'Reason.', fetching(new Error('offline')))).toEqual({ status: 'failed' });
  });

  it.each([
    ['ESTIMATE_NOT_APPROVED', 'This estimate has not been approved.'],
    ['CUSTOMER_DELETED', UNLOCK_CUSTOMER_DELETED_MESSAGE],
    ['MATERIAL_DELETED', 'A material chosen for a part of this estimate was deleted, so the estimate cannot be unlocked. The approval was not changed.'],
  ])('a 409 %s is a refusal with its code and the server\'s own sentence', async (code, title) => {
    const outcome = await unlockEstimate(ESTIMATE, 'Reason.', fetching(answer({ type: 'about:blank', title, status: 409, code }, 409)));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: 409, code, title });
  });

  it('a 422 under `reason` reaches the dialog as the reason\'s own message, so it is shown under that field and the typed text is kept', async () => {
    const body = { type: 'about:blank', title: UNLOCK_REASON_TOO_LONG_MESSAGE, status: 422, code: 'VALIDATION_FAILED', errors: [{ field: 'reason', message: UNLOCK_REASON_TOO_LONG_MESSAGE }] };
    const outcome = await unlockEstimate(ESTIMATE, 'x'.repeat(501), fetching(answer(body, 422)));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: 422, fields: { reason: 'Use 500 characters or fewer.' } });
  });
});
