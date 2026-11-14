import { getUserRepository } from '@/server/composition';
import { NO_STORE } from '@/server/http/problem';

/**
 * `GET /api/health` (architecture sections 9.4 and 9.9; STORY-10.04 AC-1, AC-8): 200 when the database answers, 503 when it does not.
 * The Windows install and update scripts wait for it, and the uptime monitor will call it.
 *
 * Public, with no session and no input, so it does not go through `withRoute` (it is listed with the other own-protected public routes in
 * `tests/support/route-files.ts`). It says only `ok` or `unavailable`: no version, no setting, no error text and no count, so it tells a
 * stranger nothing. It asks the runtime role whether any Admin exists (`hasAnyAdmin`); the answer is not used, only that the database replied.
 *
 * Scope note: section 9.4 also asks for a worker heartbeat under 3 minutes old. The worker's jobs and its heartbeat belong to the
 * worker story (ADR-011); until then this answers for the database alone. That story adds the heartbeat check here.
 */
const NO_CACHE_HEADERS = { 'Cache-Control': NO_STORE } as const;

export async function GET(): Promise<Response> {
  try {
    await getUserRepository().hasAnyAdmin();
    return Response.json({ status: 'ok' }, { headers: NO_CACHE_HEADERS });
  } catch {
    // The error is not printed or returned: it may carry a connection detail. The monitor sees the 503.
    return Response.json({ status: 'unavailable' }, { status: 503, headers: NO_CACHE_HEADERS });
  }
}
