import { describe, expect, it } from 'vitest';

import { ROUTE_MANIFEST } from '@/server/http/route-manifest';

import { findLoadingProblems, readLoadingFiles } from '../support/loading-boundaries';
import { readRouteFiles } from '../support/route-files';

/**
 * QLT-72: no `loading.tsx` at or above a page that can refuse a role (it would turn the 403 into a streamed 200; see
 * `tests/support/loading-boundaries.ts`). The planted-fault tests prove the guard can fail.
 */

const PAGES = readRouteFiles().filter((file) => file.kind === 'page');

describe('QLT-72: loading boundaries and pages that refuse a role', () => {
  it('finds the pages to look at (the scan is not empty), among them the Admin-only /users', () => {
    expect(PAGES.map((page) => page.pattern)).toEqual(expect.arrayContaining(['/users', '/queue']));
  });

  it('has no problem in the source tree', () => {
    expect(findLoadingProblems(readLoadingFiles(), PAGES, ROUTE_MANIFEST)).toEqual([]);
  });

  it('a loading.tsx beside /users fails', () => {
    const problems = findLoadingProblems(['src/app/(portal)/users/loading.tsx'], PAGES, ROUTE_MANIFEST);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('src/app/(portal)/users/page.tsx');
  });

  it('a loading.tsx on the portal group, above every page of it, fails for each page that can refuse a role', () => {
    const problems = findLoadingProblems(['src/app/(portal)/loading.tsx'], PAGES, ROUTE_MANIFEST);
    expect(problems.some((problem) => problem.includes('(portal)/users/page.tsx'))).toBe(true);
    expect(problems.some((problem) => problem.includes('(portal)/queue/page.tsx'))).toBe(false);
  });

  it('a loading.tsx beside a page every role may open is allowed', () => {
    expect(findLoadingProblems(['src/app/(portal)/queue/loading.tsx'], PAGES, ROUTE_MANIFEST)).toEqual([]);
  });

  it('a loading.tsx in another branch of the tree is not above /users', () => {
    expect(findLoadingProblems(['src/app/(public)/loading.tsx'], PAGES, ROUTE_MANIFEST)).toEqual([]);
  });
});
