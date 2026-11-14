import type { RoleName } from '../../src/lib/auth/roles';
import { isStateChanging, ROUTE_MANIFEST, type HttpMethod, type RouteRow } from '../../src/server/http/route-manifest';

/**
 * The call lists behind the two loops of `tests/security` that had nothing to iterate over (QLT-64, GitHub #81):
 *   - the per-route CSRF loop (`csrf.test.ts`): every state-changing method of every implemented, non-public API route;
 *   - the "same 403 for a real and an invented ID" loop (`role-matrix.test.ts`): every method of every implemented API
 *     route, once for each role the route does not allow.
 * A `for` or an `it.each` over an empty list passes without checking anything, so each list is built here and **throws when it
 * is empty**: a test file that builds its list from the manifest and finds nothing fails to load, instead of going green.
 * `tests/unit/security-loops.test.ts` gives each builder a manifest with no such route and requires the throw. The loop bodies
 * count their own iterations (`expectEveryCallRan`), so a body that is skipped for every call fails as well.
 */

export class EmptyLoopError extends Error {
  constructor(readonly loop: string) {
    super(`The "${loop}" loop has nothing to iterate over: no implemented route of that kind is in the route manifest, so it would pass without checking anything.`);
    this.name = 'EmptyLoopError';
  }
}

/** The list itself, or an `EmptyLoopError` when it has no entry. */
export function nonEmpty<T>(loop: string, entries: ReadonlyArray<T>): ReadonlyArray<T> {
  if (entries.length === 0) throw new EmptyLoopError(loop);
  return entries;
}

/** Fails unless the loop body ran once for each call and at least once. Call it after the loop. */
export function expectEveryCallRan(loop: string, ran: number, expected: number): void {
  if (expected === 0 || ran === 0) throw new EmptyLoopError(loop);
  if (ran !== expected) throw new Error(`The "${loop}" loop ran ${ran} times and should have run ${expected}.`);
}

const isImplementedProtectedApi = (row: RouteRow): boolean => row.kind === 'api' && row.status === 'implemented' && row.roles !== 'public';

export interface RouteCall {
  readonly name: string;
  readonly row: RouteRow;
  readonly method: HttpMethod;
}

export interface RefusedRoleCall extends RouteCall {
  readonly role: RoleName;
}

export const CSRF_LOOP = 'per-route CSRF';
export const SAME_403_LOOP = 'same 403 for a real and an invented ID';

/** Every state-changing method of every implemented, non-public API route. Throws when there is none. */
export function stateChangingCalls(manifest: ReadonlyArray<RouteRow> = ROUTE_MANIFEST): ReadonlyArray<RouteCall> {
  const calls = manifest
    .filter(isImplementedProtectedApi)
    .flatMap((row) => row.methods.filter((method) => isStateChanging(method)).map((method) => ({ name: `${method} ${row.path}`, row, method })));
  return nonEmpty(CSRF_LOOP, calls);
}

/**
 * Every method of every implemented, non-public API route, once for each role that `isAllowed` says the route refuses.
 * `isAllowed` is the table written out from the SPEC in the role matrix, not the manifest, so a wrong row cannot agree with
 * itself. Throws when no role is refused anywhere.
 */
export function refusedRoleCalls(
  isAllowed: (path: string, role: RoleName, method: HttpMethod) => boolean,
  manifest: ReadonlyArray<RouteRow> = ROUTE_MANIFEST,
  roles: ReadonlyArray<RoleName> = ['ADMIN', 'LEAD', 'ENGINEER'],
): ReadonlyArray<RefusedRoleCall> {
  const calls = manifest.filter(isImplementedProtectedApi).flatMap((row) =>
    row.methods
      .filter((method) => method !== 'HEAD')
      .flatMap((method) => roles.filter((role) => !isAllowed(row.path, role, method)).map((role) => ({ name: `${method} ${row.path} as ${role}`, row, method, role }))),
  );
  return nonEmpty(SAME_403_LOOP, calls);
}
