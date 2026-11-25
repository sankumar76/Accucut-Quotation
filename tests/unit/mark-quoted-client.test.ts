import { describe, expect, it, vi } from 'vitest';

import { markEstimateQuoted } from '@/lib/estimates/mark-quoted-client';
import { TRANSITION_REFUSALS } from '@/lib/estimate/state-machine';

/**
 * CR-01 item 7C, AC-3 and AC-4 (AQP-400; UX spec SCR-06 "Mark as quoted"): the browser's call of Mark as quoted. `fetch` is replaced, so the test answers for the server. Nothing is read from a good answer but that the
 * status is QUOTED (the page is drawn again by the server, so no marker is kept); a refusal arrives with its code and the server's own sentence, which is how the screen tells a second press ("already quoted", treated
 * as done) from the other refusals; an answer of the wrong shape is a failure, never a success that might be wrong. The call has no body. Every name and ID is invented.
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

describe('markEstimateQuoted', () => {
  it('sends POST /api/v1/estimates/{id}/quoted with no body, and is ok when the status is QUOTED', async () => {
    const doFetch = fetching(answer({ status: 'QUOTED', quoted: { at: '2026-11-23T04:30:00.000Z', byName: 'Kiran Bose' } }));
    expect(await markEstimateQuoted(ESTIMATE, doFetch)).toEqual({ status: 'ok', value: true });
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/estimates/${ESTIMATE}/quoted`);
    const init = doFetch.mock.calls[0]?.[1];
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(init?.body).toBeUndefined();
  });

  it('encodes the estimate ID into the path', async () => {
    const doFetch = fetching(answer({ status: 'QUOTED' }));
    await markEstimateQuoted('a/b c', doFetch);
    expect(doFetch.mock.calls[0]?.[0]).toBe('/api/v1/estimates/a%2Fb%20c/quoted');
  });

  it.each([
    ['a status that is not QUOTED', answer({ status: 'APPROVED' })],
    ['no status', answer({ quoted: {} })],
    ['a body that is not an object', answer('QUOTED')],
    ['a body that is not JSON', new Response('<html>', { status: 200 })],
    ['a server fault', answer({ code: 'INTERNAL', title: 'x' }, 500)],
    ['the network', new Error('Invented network failure.')],
  ])('%s is a failure, never a success', async (_name, response) => {
    expect(await markEstimateQuoted(ESTIMATE, fetching(response))).toEqual({ status: 'failed' });
  });

  it.each([
    ['a second press', TRANSITION_REFUSALS.ALREADY_QUOTED],
    ['an estimate that is not approved', TRANSITION_REFUSALS.NOT_APPROVED],
    ['an ignored estimate', TRANSITION_REFUSALS.IGNORED],
  ])('%s is a 409 refusal with its code and the server\'s own sentence', async (_name, refusal) => {
    const outcome = await markEstimateQuoted(ESTIMATE, fetching(answer({ type: 'about:blank', title: refusal.message, status: 409, code: refusal.code }, 409)));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: 409, code: refusal.code, title: refusal.message });
  });
});
