import { z } from 'zod';

/**
 * Routes that must answer "not found" in a production build, and the way to tell from the build output (CI stage 9,
 * G6 STD-05). `next build` writes a `.meta` file beside each prerendered page with the HTTP status the page will
 * answer with; a page that calls `notFound()` at build time gets 404.
 */

export const HIDDEN_IN_PRODUCTION: ReadonlyArray<{ readonly route: string; readonly metaFile: string }> = [
  { route: '/design-system', metaFile: '.next/server/app/design-system.meta' },
];

const metaSchema = z.object({ status: z.number() });

/** The status recorded in a `.meta` file, or `undefined` when the text is not a Next.js prerender record. */
export function statusFromMeta(text: string): number | undefined {
  try {
    const parsed = metaSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data.status : undefined;
  } catch {
    return undefined;
  }
}

/** One line per route that is not a 404; `read` returns a file's text, or `undefined` when it does not exist. */
export function findExposedRoutes(read: (path: string) => string | undefined): string[] {
  return HIDDEN_IN_PRODUCTION.flatMap(({ route, metaFile }) => {
    const text = read(metaFile);
    if (text === undefined) return [`${route}: ${metaFile} is missing, so the build output cannot be checked`];
    const status = statusFromMeta(text);
    return status === 404 ? [] : [`${route}: the production build answers ${status ?? 'an unreadable status'}, not 404`];
  });
}
