import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sendJson } from '@/lib/api-client';
import { fetchAuditPage } from '@/lib/audit/audit-client';
import { NO_FILTERS } from '@/lib/audit/filters';
import { listUsers } from '@/lib/users/users-client';

/**
 * STORY-01.06 AC-4: an API call or a background fetch after the session ended gets 401 `application/problem+json` with the code
 * SESSION_ENDED, and the client then goes to SCR-01 in its "Session ended" state, keeping the page the person was on. Three clients
 * read a refusal (the shared one for the masters, the Users one and the audit one); each is held to the same rule. A 401 without
 * that code, and any other refusal, does not move the person.
 */

const SESSION_ENDED_BODY = { type: 'about:blank', title: 'Your session ended. Sign in again.', status: 401, code: 'SESSION_ENDED', requestId: 'req-00000001' };
const SIGNED_OUT_BODY = { type: 'about:blank', title: 'Sign in to continue.', status: 401, code: 'UNAUTHORIZED', requestId: 'req-00000002' };
const FORBIDDEN_BODY = { type: 'about:blank', title: 'You do not have access to this.', status: 403, code: 'FORBIDDEN', requestId: 'req-00000003' };

const assign = vi.fn();

function answering(status: number, body: unknown): typeof fetch {
  return () => Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/problem+json' } }));
}

beforeEach(() => {
  assign.mockClear();
  vi.stubGlobal('window', { location: { pathname: '/masters/materials', search: '?q=steel', assign } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const CLIENTS: ReadonlyArray<readonly [string, (doFetch: typeof fetch) => Promise<unknown>]> = [
  ['the shared client (masters)', (doFetch) => sendJson(doFetch, '/api/v1/test', { method: 'GET' }, (body) => body)],
  ['the Users client', (doFetch) => listUsers(doFetch)],
  ['the audit client', (doFetch) => fetchAuditPage(NO_FILTERS, undefined, doFetch)],
];

describe.each(CLIENTS)('AC-4: %s', (_name, call) => {
  it('goes to SCR-01 in its "Session ended" state, keeping the page the person was on, when the session ended', async () => {
    await call(answering(401, SESSION_ENDED_BODY));
    expect(assign).toHaveBeenCalledExactlyOnceWith('/sign-in?reason=session-ended&callbackUrl=%2Fmasters%2Fmaterials%3Fq%3Dsteel');
  });

  it('does not move the person for a 401 that is not "session ended"', async () => {
    await call(answering(401, SIGNED_OUT_BODY));
    expect(assign).not.toHaveBeenCalled();
  });

  it('does not move the person for another refusal, a body that is not JSON, or a server fault', async () => {
    await call(answering(403, FORBIDDEN_BODY));
    await call(answering(401, 'not json'));
    await call(answering(500, { code: 'SESSION_ENDED' }));
    expect(assign).not.toHaveBeenCalled();
  });

  it('does not move the person when the call works', async () => {
    await call(answering(200, { users: [], entries: [], total: 0, nextCursor: null }));
    expect(assign).not.toHaveBeenCalled();
  });
});
