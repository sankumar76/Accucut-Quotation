import { describe, expect, it } from 'vitest';

import { findExposedRoutes, HIDDEN_IN_PRODUCTION, statusFromMeta } from '../../scripts/lib/production-routes';

/** G6 STD-05: the production 404 of /design-system is checked on the build output in CI stage 9, not only by hand. */

const META_404 = JSON.stringify({ status: 404, headers: { 'x-nextjs-prerender': '1' } });
const META_200 = JSON.stringify({ headers: { 'x-nextjs-prerender': '1' }, status: 200 });

describe('production route check', () => {
  it('names /design-system', () => {
    expect(HIDDEN_IN_PRODUCTION.map((entry) => entry.route)).toContain('/design-system');
  });

  it('reads the status from a Next.js .meta file, and says nothing for text that is not one', () => {
    expect(statusFromMeta(META_404)).toBe(404);
    expect(statusFromMeta('{"headers":{}}')).toBeUndefined();
    expect(statusFromMeta('not json')).toBeUndefined();
  });

  it('passes when every hidden route is a 404', () => {
    expect(findExposedRoutes(() => META_404)).toEqual([]);
  });

  it('fails when the route would be served', () => {
    expect(findExposedRoutes(() => META_200)).toEqual(['/design-system: the production build answers 200, not 404']);
  });

  it('fails when the build output is missing or unreadable, so a change in the Next.js layout is noticed', () => {
    expect(findExposedRoutes(() => undefined)[0]).toContain('is missing');
    expect(findExposedRoutes(() => 'garbage')[0]).toContain('unreadable status');
  });
});
