import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  APP_PATHS_MANIFEST,
  findExposedRoutes,
  findNegativeControlGateProblems,
  HIDDEN_IN_PRODUCTION,
  statusFromMeta,
} from '../../scripts/lib/production-routes';

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

  // STORY-01.01: every page of the (portal) group asks who is signed in, so /design-system is rendered per request and
  // the build writes no prerender record for it. tests/e2e/production-routes.spec.ts asks the production server for it.
  describe('a route rendered per request has no prerender record', () => {
    const manifest = JSON.stringify({ '/design-system/page': 'app/design-system/page.js', '/queue/page': 'app/queue/page.js' });
    const withManifest = (text: string | undefined) => (path: string) => (path === APP_PATHS_MANIFEST ? text : undefined);

    it('passes when the build manifest can be read, because the status is decided per request and checked end to end', () => {
      expect(findExposedRoutes(withManifest(manifest))).toEqual([]);
    });

    it('passes when the route is not in the build at all', () => {
      expect(findExposedRoutes(withManifest('{}'))).toEqual([]);
    });

    it.each([undefined, 'garbage', '[]', '{"a":1}'])('fails when the manifest is %s, so a change in the Next.js layout is noticed', (text) => {
      expect(findExposedRoutes(withManifest(text))[0]).toContain('cannot be read');
    });
  });
});

/**
 * STORY-01.03 STD-02 (G6): the test-only route is off in a production build because the bundler replaces the dot-access
 * `process.env.NODE_ENV` in its gate with a constant. The compiled text of a build that did so is below (taken from the real build); a
 * build that did not leaves `NODE_ENV` next to the route's variable, and the check must fail on it.
 */
describe('the gate of the test-only route in the build output (STD-02)', () => {
  const VARIABLE = 'CANARY_NEGATIVE_CONTROL';
  const REPLACED =
    'e.s(["GET",0,function(){let e=!function(e="production"){return"test"===e}()?void 0:' +
    'function(e=process.env.CANARY_NEGATIVE_CONTROL){let t=e?.trim();return void 0===t||""===t?void 0:t}();' +
    'return void 0===e?new Response(null,{status:404}):Response.json({leaked:e})}],63185)';
  const file = (text: string) => [{ path: '.next/server/chunks/route.js', text }];

  it('passes when the bundler replaced the read: the variable is read and no NODE_ENV stands near it', () => {
    expect(findNegativeControlGateProblems(file(REPLACED), VARIABLE)).toEqual([]);
  });

  it.each([
    ['a bracketed read', 'function(e=process.env["NODE_ENV"]){return"test"===e}()?process.env.CANARY_NEGATIVE_CONTROL:void 0'],
    ['a destructured read', 'let{NODE_ENV:n}=process.env;return"test"===n?process.env.CANARY_NEGATIVE_CONTROL:void 0'],
    ['a computed read', 'let k="NODE_"+"ENV";const n=process.env[k]; /* NODE_ENV */ return"test"===n?process.env.CANARY_NEGATIVE_CONTROL:void 0'],
  ])('fails on %s (a planted fault), naming the file', (_name, text) => {
    const problems = findNegativeControlGateProblems(file(text), VARIABLE);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('.next/server/chunks/route.js');
    expect(problems[0]).toContain('reads NODE_ENV at run time');
  });

  it('ignores a NODE_ENV read far from the route, in a file that only happens to hold it too', () => {
    const far = `${'x'.repeat(2000)}process.env.NODE_ENV${'y'.repeat(2000)}`;
    expect(findNegativeControlGateProblems(file(`${far}${REPLACED}${'z'.repeat(2000)}`), VARIABLE)).toEqual([]);
  });

  it('fails closed when no compiled file reads the variable, so a renamed or missing route is noticed', () => {
    expect(findNegativeControlGateProblems(file('nothing here'), VARIABLE)[0]).toContain('cannot be checked');
    expect(findNegativeControlGateProblems([], VARIABLE)[0]).toContain('cannot be checked');
  });

  it('the gate source keeps the read the bundler replaces: a dot-access default, in the gate and nowhere else in the route', () => {
    const gate = readFileSync(fileURLToPath(new URL('../../src/lib/negative-control-gate.ts', import.meta.url)), 'utf8');
    const route = readFileSync(fileURLToPath(new URL('../../src/app/api/test-only/leak/route.ts', import.meta.url)), 'utf8');
    expect(gate).toContain('nodeEnv: string | undefined = process.env.NODE_ENV');
    for (const form of [/process\.env\s*\[\s*['"`]NODE_ENV/, /\{\s*NODE_ENV\s*[:}]/, /env\.NODE_ENV\s*\?\?/]) {
      expect(gate, String(form)).not.toMatch(form);
      expect(route, String(form)).not.toMatch(form);
    }
    // The route reads the environment only through the gate, so nothing in it can bypass the replaced read.
    expect(route).toContain("from '@/lib/negative-control-gate'");
  });
});
