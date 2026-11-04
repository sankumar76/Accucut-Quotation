import { z } from 'zod';

/**
 * Routes that must answer "not found" in a production build, and the way to tell from the build output (CI stage 9,
 * G6 STD-05).
 *
 * A page that is prerendered at build time gets a `.meta` file beside it with the HTTP status the page will answer with,
 * and a page that calls `notFound()` at build time gets 404: that is read here. Since STORY-01.01 every page of the
 * `(portal)` group asks who is signed in, so `/design-system` is rendered per request and has no `.meta` file. The build
 * output cannot then prove its status; the production end-to-end spec `tests/e2e/production-routes.spec.ts` requests it
 * from the production server, signed in, and requires 404. This check still fails if the route is prerendered with any
 * other status, or if the build output has a shape it does not understand.
 */

export const HIDDEN_IN_PRODUCTION: ReadonlyArray<{ readonly route: string; readonly metaFile: string }> = [
  { route: '/design-system', metaFile: '.next/server/app/design-system.meta' },
];

/** Lists the routes the build can serve, as `"/design-system/page": "app/design-system/page.js"`. */
export const APP_PATHS_MANIFEST = '.next/server/app-paths-manifest.json';

const metaSchema = z.object({ status: z.number() });
const manifestSchema = z.record(z.string(), z.string());

/** The status recorded in a `.meta` file, or `undefined` when the text is not a Next.js prerender record. */
export function statusFromMeta(text: string): number | undefined {
  try {
    const parsed = metaSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data.status : undefined;
  } catch {
    return undefined;
  }
}

/** The routes of the build's manifest, or `undefined` when the text is not one. */
function routesOfManifest(text: string): ReadonlySet<string> | undefined {
  try {
    const parsed = manifestSchema.safeParse(JSON.parse(text));
    return parsed.success ? new Set(Object.keys(parsed.data)) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * One line per route that is not a 404; `read` returns a file's text, or `undefined` when it does not exist. A route
 * with no prerender record passes only when the manifest shows it is rendered per request (checked end to end) or is
 * not in the build at all.
 */
export function findExposedRoutes(read: (path: string) => string | undefined): string[] {
  return HIDDEN_IN_PRODUCTION.flatMap(({ route, metaFile }) => {
    const text = read(metaFile);
    if (text === undefined) return missingMetaProblems(route, metaFile, read);
    const status = statusFromMeta(text);
    return status === 404 ? [] : [`${route}: the production build answers ${status ?? 'an unreadable status'}, not 404`];
  });
}

function missingMetaProblems(route: string, metaFile: string, read: (path: string) => string | undefined): string[] {
  const manifest = read(APP_PATHS_MANIFEST);
  if (manifest === undefined || routesOfManifest(manifest) === undefined) {
    return [`${route}: ${metaFile} is missing and ${APP_PATHS_MANIFEST} cannot be read, so the build output cannot be checked`];
  }
  // Rendered per request, or not in the build at all: the status is decided when the page is asked for, and
  // tests/e2e/production-routes.spec.ts asks the production server for it.
  return [];
}
