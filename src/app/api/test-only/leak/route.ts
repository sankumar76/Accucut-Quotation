import { isNegativeControlEnabled, negativeControlSentinel } from '@/lib/negative-control-gate';
import { NO_STORE } from '@/server/http/problem';

/**
 * The negative control of the cost-confidentiality scan (STORY-01.03 AC-4; ADR-008 layer 5; test strategy section 6): a route
 * that deliberately leaks ONE invented sentinel, so the scan can prove it finds a planted leak. If the scan cannot find this,
 * its suite fails, and a green scan means nothing.
 *
 * It exists only when `NODE_ENV` is `test`, which is Vitest's value and no Next.js server bundle's: the bundler replaces the
 * dot-access `process.env.NODE_ENV` in the gate with `development` or `production` at build time, so the check is a constant
 * there, whatever the runtime environment says (the reason, and the check that pins it, are in `src/lib/negative-control-gate.ts`).
 * Everywhere else it answers 404 with no body. The sentinel is not in the source: the test supplies it through the environment, so
 * a build holds nothing to find. It is the only test-only route (assumption A-2). The manifest lists it as a public `testOnly` row,
 * so it is in no role's list and the scan never treats it as an Engineer route.
 */
export function GET(): Response {
  const sentinel = isNegativeControlEnabled() ? negativeControlSentinel() : undefined;
  if (sentinel === undefined) return new Response(null, { status: 404, headers: { 'Cache-Control': NO_STORE } });
  return Response.json({ leaked: sentinel }, { headers: { 'Cache-Control': NO_STORE } });
}
