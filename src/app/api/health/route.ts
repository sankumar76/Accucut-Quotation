import { isHeartbeatFresh } from '@/lib/health/heartbeat';
import { systemClock } from '@/lib/time';
import { getHeartbeatRepository } from '@/server/composition';
import { clientAddressFrom } from '@/server/auth/client-address';
import { NO_STORE } from '@/server/http/problem';

/**
 * `GET /api/health` (architecture sections 9.4 and 9.9; STORY-10.04 AC-1, AC-8; STORY-10.09a AC-6, NFR-012): 200 only while the database answers and the worker's newest
 * heartbeat is less than 3 minutes old; 503 when the database does not answer, when there is no heartbeat at all and when the newest one is 3 minutes old or more. The
 * Windows install, update and restore scripts wait for it, and the uptime monitor will call it. A stopped worker therefore turns it red within 3 minutes.
 *
 * Public, with no session and no input, so it does not go through `withRoute` (it is listed with the other own-protected public routes in
 * `tests/support/route-files.ts`). It says only `ok` or `unavailable`: no version, no setting, no error text, no count, and never which check failed, so it tells a
 * stranger nothing. One read does both checks: the newest `heartbeat` row's `finished_at` (one index descent), which fails when the database is down.
 *
 * It also says, in `X-Client-Address-Seen`, the address the portal worked out for the caller by the rule of the sign-in limit (`clientAddressFrom`: the last entry of
 * `X-Forwarded-For`, a well-formed address with no port), or `none`. That lets the install see that the reverse proxy writes the real address (check C5 of the install guide, GitHub issue 576). It is
 * the caller's own address, on a 503 as well as a 200, so it tells a stranger nothing.
 */
const CLIENT_ADDRESS_HEADER = 'X-Client-Address-Seen';
const NO_ADDRESS = 'none';

function answer(body: { readonly status: 'ok' | 'unavailable' }, status: number, request: Request | undefined): Response {
  const seen = clientAddressFrom(request === undefined ? undefined : Object.fromEntries(request.headers));
  return Response.json(body, { status, headers: { 'Cache-Control': NO_STORE, [CLIENT_ADDRESS_HEADER]: seen ?? NO_ADDRESS } });
}

export async function GET(request?: Request): Promise<Response> {
  try {
    const latest = await getHeartbeatRepository().latestHeartbeatAt();
    if (!isHeartbeatFresh(latest, systemClock.now())) return answer({ status: 'unavailable' }, 503, request);
    return answer({ status: 'ok' }, 200, request);
  } catch {
    // The error is not printed or returned: it may carry a connection detail. The monitor sees the 503.
    return answer({ status: 'unavailable' }, 503, request);
  }
}
