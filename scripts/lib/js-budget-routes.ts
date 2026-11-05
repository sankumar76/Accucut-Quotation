/**
 * Which routes the JS budget check requests (test strategy section 10.1, STORY-10.10 AC-1 and AC-2).
 *
 * Two sources: the route manifest (STORY-01.02), which also says which roles may open each route, and until it exists
 * the build's own list of app paths, `.next/server/app-paths-manifest.json`, with the Admin as the only role. A route
 * the check cannot turn into a request (a dynamic segment with no invented record, a shape it does not know) becomes a
 * target that fails with its reason; nothing is dropped silently.
 */

export type RouteKind = 'page' | 'not-found' | 'hidden';

/** A page route as the source describes it. `pattern` is the URL pattern, for example `/estimates/[id]`. */
export interface PageRoute {
  readonly pattern: string;
  /** The roles that may open it; the check requests it as each, signed in. */
  readonly roles: ReadonlyArray<string>;
}

/** What the check requests, and how a response is judged. */
export interface RouteTarget {
  /** The row label: the pattern, or `not-found`. */
  readonly route: string;
  readonly kind: RouteKind;
  /** The path to request. Absent when the target cannot be requested, and `problem` says why. */
  readonly path?: string;
  readonly roles: ReadonlyArray<string>;
  readonly problem?: string;
}

/** Until the route manifest exists, every route is opened as the Admin (STORY-10.10 AC-1). */
export const DEFAULT_ROLES: ReadonlyArray<string> = ['ADMIN'];

/** The row label and the request path of the not-found page: a path no route uses (AC-2). */
export const NOT_FOUND_ROW = 'not-found';
export const NOT_FOUND_PROBE_PATH = '/nfr-009-unused-path';

/** The app-path key of the not-found page and of other framework pages, which are not routes of the product. */
const FRAMEWORK_KEY = /^\/_/;
const ROUTE_GROUP = /^\(.+\)$/;
/** A parallel slot (`@name`) or an intercepting route (`(.)x`, `(..)x`, `(...)x`): a shape this check has no request for. */
const UNSUPPORTED_SEGMENT = /^@|^\(\.{1,3}\)/;
const PAGE_SUFFIX = '/page';

/** Order by code point, so the table does not depend on the machine's locale. */
function byPattern(a: { readonly pattern: string }, b: { readonly pattern: string }): number {
  return a.pattern < b.pattern ? -1 : a.pattern > b.pattern ? 1 : 0;
}

export interface RouteSource {
  readonly routes: ReadonlyArray<PageRoute>;
  readonly problems: ReadonlyArray<string>;
}

/**
 * The page routes in the build's app-path list (`"/(portal)/queue/page": "app/(portal)/queue/page.js"`). Route
 * handlers (`.../route`) and framework pages (`/_not-found/page`) are not pages of the product and are left out; that
 * is a rule, not a silent skip. A page whose key has a shape the check cannot request is a problem.
 */
export function pageRoutesFromAppPaths(manifest: Readonly<Record<string, string>>): RouteSource {
  const routes: PageRoute[] = [];
  const problems: string[] = [];
  for (const key of Object.keys(manifest).sort()) {
    if (!key.endsWith(PAGE_SUFFIX) || FRAMEWORK_KEY.test(key)) continue;
    const segments = key.slice(0, -PAGE_SUFFIX.length).split('/').filter((segment) => segment !== '');
    if (segments.some((segment) => UNSUPPORTED_SEGMENT.test(segment))) {
      problems.push(`${key}: a parallel or intercepting route has no request the check knows how to make`);
      continue;
    }
    const visible = segments.filter((segment) => !ROUTE_GROUP.test(segment));
    routes.push({ pattern: `/${visible.join('/')}`, roles: DEFAULT_ROLES });
  }
  return { routes: routes.sort(byPattern), problems };
}

/** The route manifest's entries as the check reads them: a URL pattern and the roles allowed on it. */
export interface ManifestEntry {
  readonly pattern: string;
  readonly roles: ReadonlyArray<string>;
}

/** The routes of the route manifest. A route that allows no role cannot be opened by anyone and is a problem. */
export function pageRoutesFromManifest(entries: ReadonlyArray<ManifestEntry>): RouteSource {
  const routes: PageRoute[] = [];
  const problems: string[] = [];
  for (const entry of [...entries].sort(byPattern)) {
    if (entry.roles.length === 0) problems.push(`${entry.pattern}: the route manifest allows no role on it, so it cannot be requested signed in`);
    else routes.push({ pattern: entry.pattern, roles: [...entry.roles] });
  }
  return { routes, problems };
}

function isDynamic(pattern: string): boolean {
  return pattern.split('/').some((segment) => segment.startsWith('['));
}

/**
 * Turns routes into requests. `recordPaths` holds, for a dynamic route, the path of a record the script created from
 * invented data (`'/estimates/[id]': '/estimates/<id>'`); without one the route fails (AC-2). `hidden` lists the routes
 * a production build must answer 404 for on purpose (`HIDDEN_IN_PRODUCTION`); they are requested and expected to be 404.
 */
export function buildTargets(
  source: RouteSource,
  recordPaths: Readonly<Record<string, string>>,
  hidden: ReadonlySet<string>,
): RouteTarget[] {
  const targets: RouteTarget[] = source.routes.map((route): RouteTarget => {
    const kind: RouteKind = hidden.has(route.pattern) ? 'hidden' : 'page';
    if (!isDynamic(route.pattern)) return { route: route.pattern, kind, path: route.pattern, roles: route.roles };
    const path = recordPaths[route.pattern];
    return path === undefined
      ? { route: route.pattern, kind, roles: route.roles, problem: 'a dynamic segment needs a record made from invented data, and none could be made' }
      : { route: route.pattern, kind, path, roles: route.roles };
  });
  const sourceProblems = source.problems.map((problem): RouteTarget => ({ route: problem.split(':')[0] ?? problem, kind: 'page', roles: [], problem }));
  return [...targets, ...sourceProblems, { route: NOT_FOUND_ROW, kind: 'not-found', path: NOT_FOUND_PROBE_PATH, roles: DEFAULT_ROLES }];
}
