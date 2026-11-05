import { describe, expect, it } from 'vitest';

import { HIDDEN_IN_PRODUCTION } from '../../scripts/lib/production-routes';
import {
  DEFAULT_ROLES,
  NOT_FOUND_PROBE_PATH,
  NOT_FOUND_ROW,
  buildTargets,
  pageRoutesFromAppPaths,
  pageRoutesFromManifest,
} from '../../scripts/lib/js-budget-routes';

/** STORY-10.10 AC-1 and AC-2: the route list, from the route manifest or, until it exists, the build's app paths. */

// The shape Next.js writes to .next/server/app-paths-manifest.json (a fixture, not the real build).
const APP_PATHS = {
  '/_not-found/page': 'app/_not-found/page.js',
  '/(portal)/page': 'app/(portal)/page.js',
  '/(portal)/queue/page': 'app/(portal)/queue/page.js',
  '/(portal)/design-system/page': 'app/(portal)/design-system/page.js',
  '/(public)/sign-in/page': 'app/(public)/sign-in/page.js',
  '/api/auth/[...nextauth]/route': 'app/api/auth/[...nextauth]/route.js',
  '/(portal)/estimates/[estimateId]/page': 'app/(portal)/estimates/[estimateId]/page.js',
};

describe('pageRoutesFromAppPaths (the source until the route manifest exists)', () => {
  it('lists the page routes by URL: route groups dropped, the root as "/", framework pages and route handlers left out', () => {
    const { routes, problems } = pageRoutesFromAppPaths(APP_PATHS);
    expect(routes.map((route) => route.pattern)).toEqual(['/', '/design-system', '/estimates/[estimateId]', '/queue', '/sign-in']);
    expect(problems).toEqual([]);
  });

  it('opens every route as the Admin only', () => {
    const { routes } = pageRoutesFromAppPaths(APP_PATHS);
    expect(routes.every((route) => route.roles.join() === 'ADMIN')).toBe(true);
    expect(DEFAULT_ROLES).toEqual(['ADMIN']);
  });

  it('reports a parallel or intercepting route instead of leaving it out', () => {
    const { routes, problems } = pageRoutesFromAppPaths({
      '/(portal)/@modal/photo/page': 'x',
      '/(portal)/feed/(..)photo/page': 'y',
      '/(portal)/ok/page': 'z',
    });
    expect(routes.map((route) => route.pattern)).toEqual(['/ok']);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('/(portal)/@modal/photo/page');
  });
});

describe('pageRoutesFromManifest (the route manifest of STORY-01.02)', () => {
  it('keeps the roles the manifest allows on each route, in a fixed order', () => {
    const { routes, problems } = pageRoutesFromManifest([
      { pattern: '/queue', roles: ['LEAD', 'ADMIN'] },
      { pattern: '/audit', roles: ['ADMIN'] },
    ]);
    expect(routes).toEqual([
      { pattern: '/audit', roles: ['ADMIN'] },
      { pattern: '/queue', roles: ['LEAD', 'ADMIN'] },
    ]);
    expect(problems).toEqual([]);
  });

  it('reports a route that allows no role, because nobody could open it signed in', () => {
    const { routes, problems } = pageRoutesFromManifest([{ pattern: '/nobody', roles: [] }]);
    expect(routes).toEqual([]);
    expect(problems).toEqual(['/nobody: the route manifest allows no role on it, so it cannot be requested signed in']);
  });
});

describe('buildTargets (AC-2)', () => {
  const hidden = new Set(HIDDEN_IN_PRODUCTION.map((entry) => entry.route));
  const source = pageRoutesFromAppPaths(APP_PATHS);

  it('always ends with the not-found page, requested at a path no route uses', () => {
    const targets = buildTargets({ routes: [], problems: [] }, {}, hidden);
    expect(targets).toEqual([{ route: NOT_FOUND_ROW, kind: 'not-found', path: NOT_FOUND_PROBE_PATH, roles: ['ADMIN'] }]);
    expect(NOT_FOUND_ROW).toBe('not-found');
    expect(source.routes.some((route) => route.pattern === NOT_FOUND_PROBE_PATH)).toBe(false);
  });

  it('marks a route the production build hides on purpose, so it is expected to answer 404', () => {
    const targets = buildTargets(source, {}, hidden);
    expect(targets.find((target) => target.route === '/design-system')).toMatchObject({ kind: 'hidden', path: '/design-system' });
    expect(targets.find((target) => target.route === '/queue')).toMatchObject({ kind: 'page', path: '/queue' });
  });

  it('fails a dynamic route that has no record made from invented data', () => {
    const target = buildTargets(source, {}, hidden).find((entry) => entry.route === '/estimates/[estimateId]');
    expect(target?.path).toBeUndefined();
    expect(target?.problem).toContain('invented data');
  });

  it('requests a dynamic route at the record that was made for it', () => {
    const target = buildTargets(source, { '/estimates/[estimateId]': '/estimates/0001' }, hidden).find((entry) => entry.route === '/estimates/[estimateId]');
    expect(target).toMatchObject({ kind: 'page', path: '/estimates/0001' });
    expect(target?.problem).toBeUndefined();
  });

  it('turns a problem of the source into a failing target, so it is never dropped', () => {
    const targets = buildTargets({ routes: [], problems: ['/odd: has a shape the check cannot request'] }, {}, hidden);
    expect(targets[0]).toMatchObject({ route: '/odd', problem: '/odd: has a shape the check cannot request' });
  });
});
