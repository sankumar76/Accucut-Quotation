import { describe, expect, it, vi } from 'vitest';

import { TRANSITION_REFUSALS } from '@/lib/estimate/state-machine';
import { ignoreEstimate, restoreEstimate } from '@/lib/estimates/ignore-client';

/**
 * CR-01 item 7D, AC-1, AC-4, AC-8 (AQP-401; UX 12944 sections 2 and 3): the browser's calls of Ignore and Restore. `fetch` is replaced, so the test answers for the server. Ignore sends the remarks as typed (the server judges
 * and trims them); Restore sends no body at all (it has no remarks of its own); nothing is read from a good answer but that it carries a status (the page is drawn again by the server); a refusal arrives with its code and the
 * server's own sentence, which is how the dialogs tell a second press (treated as done) from every other refusal; an answer of the wrong shape is a failure. Every name and ID is invented.
 */

const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';

const answer = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } });

function fetching(response: Response | Error) {
  return vi.fn((...args: Parameters<typeof fetch>) => {
    void args;
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  });
}

const IGNORED_ANSWER = { status: 'PREPARED', ignored: { at: '2026-11-23T04:30:00.000Z', byName: 'Kiran Bose', remarks: 'Not taken forward.' } };

describe('ignoreEstimate', () => {
  it('sends POST /api/v1/estimates/{id}/ignore with the remarks as typed, and is ok on a status', async () => {
    const doFetch = fetching(answer(IGNORED_ANSWER));
    expect(await ignoreEstimate(ESTIMATE, '  Not taken forward.\n', doFetch)).toEqual({ status: 'ok', value: true });
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/estimates/${ESTIMATE}/ignore`);
    const init = doFetch.mock.calls[0]?.[1];
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(JSON.parse(String(init?.body))).toEqual({ remarks: '  Not taken forward.\n' });
  });

  it('encodes the estimate ID into the path', async () => {
    const doFetch = fetching(answer(IGNORED_ANSWER));
    await ignoreEstimate('a/b c', 'x', doFetch);
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/estimates/a%2Fb%20c/ignore');
  });

  it.each([
    ['a status that is QUOTED', answer({ status: 'QUOTED' })],
    ['no status', answer({ ignored: {} })],
    ['a body that is not an object', answer('PREPARED')],
    ['a body that is not JSON', new Response('<html>', { status: 200 })],
    ['a server fault', answer({ code: 'INTERNAL', title: 'x' }, 500)],
    ['the network', new Error('Invented network failure.')],
  ])('%s is a failure, never a success', async (_name, response) => {
    expect(await ignoreEstimate(ESTIMATE, 'x', fetching(response))).toEqual({ status: 'failed' });
  });

  it.each([
    ['a second press', TRANSITION_REFUSALS.ALREADY_IGNORED],
    ['a quoted estimate', TRANSITION_REFUSALS.QUOTED_IS_FINAL],
  ])('%s is a 409 refusal with its code and the server\'s own sentence', async (_name, refusal) => {
    const outcome = await ignoreEstimate(ESTIMATE, 'x', fetching(answer({ type: 'about:blank', title: refusal.message, status: 409, code: refusal.code }, 409)));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: 409, code: refusal.code, title: refusal.message });
  });

  it('a 422 under remarks comes back as the message of the field', async () => {
    const body = { type: 'about:blank', title: 'Check the fields', status: 422, code: 'VALIDATION', errors: [{ field: 'remarks', message: 'Enter remarks. They are kept in the audit log.' }] };
    expect(await ignoreEstimate(ESTIMATE, '', fetching(answer(body, 422)))).toMatchObject({ status: 'refused', httpStatus: 422, fields: { remarks: 'Enter remarks. They are kept in the audit log.' } });
  });
});

describe('restoreEstimate', () => {
  it('sends POST /api/v1/estimates/{id}/restore with no body, and is ok on a status', async () => {
    const doFetch = fetching(answer({ status: 'APPROVED' }));
    expect(await restoreEstimate(ESTIMATE, doFetch)).toEqual({ status: 'ok', value: true });
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/estimates/${ESTIMATE}/restore`);
    const init = doFetch.mock.calls[0]?.[1];
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(init?.body).toBeUndefined();
  });

  it.each([
    ['no status', answer({})],
    ['a body that is not an object', answer('PREPARED')],
    ['a server fault', answer({ code: 'INTERNAL', title: 'x' }, 500)],
    ['the network', new Error('Invented network failure.')],
  ])('%s is a failure, never a success', async (_name, response) => {
    expect(await restoreEstimate(ESTIMATE, fetching(response))).toEqual({ status: 'failed' });
  });

  it('a second press is the 409 ESTIMATE_NOT_IGNORED with the server\'s own sentence', async () => {
    const refusal = TRANSITION_REFUSALS.NOT_IGNORED;
    const outcome = await restoreEstimate(ESTIMATE, fetching(answer({ type: 'about:blank', title: refusal.message, status: 409, code: refusal.code }, 409)));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: 409, code: refusal.code, title: refusal.message });
  });
});
