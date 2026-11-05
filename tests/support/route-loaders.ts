/**
 * A loader for each implemented route, so the security tests can call the real handler or page (STORY-01.02 AC-2, AC-4,
 * AC-5). `import()` takes a literal path here (a computed one is forbidden by lint), so a story that adds a route adds its
 * loader in the same change; `role-matrix.test.ts` fails until it does, and the completeness test fails until the manifest
 * has the row.
 */

export type Loader = () => Promise<unknown>;

export const API_LOADERS: Readonly<Record<string, Loader>> = {
  '/api/v1/me': () => import('@/app/api/v1/me/route'),
};

export const PAGE_LOADERS: Readonly<Record<string, Loader>> = {
  '/': () => import('@/app/(portal)/page'),
  '/queue': () => import('@/app/(portal)/queue/page'),
  '/design-system': () => import('@/app/(portal)/design-system/page'),
};
