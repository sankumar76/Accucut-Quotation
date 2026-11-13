import { describe, expect, it } from 'vitest';

import { HIDDEN_IN_PRODUCTION } from '../../scripts/lib/production-routes';
import {
  DEFAULT_ROLES,
  NOT_FOUND_PROBE_PATH,
  NOT_FOUND_ROW,
  buildTargets,
  pageRoutesFromAppPaths,
  pageRoutesFromManifest,
  unlistedBuildRoutes,
  type ManifestRow,
} from '../../scripts/lib/js-budget-routes';
import { ROUTE_MANIFEST } from '../../src/server/http/route-manifest';

/**
 * STORY-10.10 AC-1 and AC-2, with STORY-01.02 (AQP-48): the route list comes from the route manifest, each page is
 * requested as a role the manifest allows on it, and the build's own list of app paths only catches a page the manifest
 * lacks.
 */

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
  const page = (path: string, roles: ManifestRow['roles'], status: ManifestRow['status'] = 'implemented'): ManifestRow => ({ path, kind: 'page', status, roles });
  const adminOnly = (role: string): boolean => role === 'ADMIN';

  it('requests a page as every allowed role the check can sign in as, in a fixed order of pages', () => {
    const { routes, problems } = pageRoutesFromManifest([page('/queue', ['LEAD', 'ADMIN']), page('/audit', ['ADMIN'])], () => true);
    expect(routes).toEqual([
      { pattern: '/audit', roles: ['ADMIN'] },
      { pattern: '/queue', roles: ['LEAD', 'ADMIN'] },
    ]);
    expect(problems).toEqual([]);
  });

  it('measures a page as a role that may see it: the roles without a sign-in are left out, not requested', () => {
    const { routes } = pageRoutesFromManifest([page('/queue', ['ADMIN', 'LEAD', 'ENGINEER'])], adminOnly);
    expect(routes).toEqual([{ pattern: '/queue', roles: ['ADMIN'] }]);
  });

  it('a public page is requested with no role at all (it answers without a session)', () => {
    expect(pageRoutesFromManifest([page('/sign-in', 'public')], () => false).routes).toEqual([{ pattern: '/sign-in', roles: [] }]);
  });

  it('leaves out an API route and a planned page', () => {
    const rows: ManifestRow[] = [{ path: '/api/v1/me', kind: 'api', status: 'implemented', roles: ['ADMIN'] }, page('/users', ['ADMIN'], 'planned')];
    expect(pageRoutesFromManifest(rows, () => true)).toEqual({ routes: [], problems: [] });
  });

  it('reports a route that allows no role, because nobody could open it signed in', () => {
    const { routes, problems } = pageRoutesFromManifest([page('/nobody', [])], () => true);
    expect(routes).toEqual([]);
    expect(problems).toEqual(['/nobody: the route manifest allows no role on it, so it cannot be requested signed in']);
  });

  it('reports a page whose allowed roles the check cannot sign in as, and does not skip it', () => {
    const { routes, problems } = pageRoutesFromManifest([page('/lead-only', ['LEAD'])], adminOnly);
    expect(routes).toEqual([]);
    expect(problems).toEqual(['/lead-only: the route manifest allows LEAD on it, but the check has no sign-in for any of those roles']);
  });

  it('with the real manifest: every implemented page is requested, as the Admin, and the pages are the ones the build has', () => {
    const { routes, problems } = pageRoutesFromManifest(ROUTE_MANIFEST, adminOnly);
    expect(problems).toEqual([]);
    expect(routes).toEqual([
      { pattern: '/', roles: ['ADMIN'] },
      { pattern: '/account', roles: ['ADMIN'] },
      { pattern: '/audit', roles: ['ADMIN'] },
      { pattern: '/design-system', roles: ['ADMIN'] },
      { pattern: '/masters/customers', roles: ['ADMIN'] },
      { pattern: '/masters/customers/[id]', roles: ['ADMIN'] },
      { pattern: '/masters/materials', roles: ['ADMIN'] },
      { pattern: '/masters/process', roles: ['ADMIN'] },
      { pattern: '/queue', roles: ['ADMIN'] },
      { pattern: '/sign-in', roles: [] },
      { pattern: '/users', roles: ['ADMIN'] },
    ]);
  });

  it('with the real manifest and no sign-in at all, every signed-in page is a problem and none is dropped', () => {
    const { routes, problems } = pageRoutesFromManifest(ROUTE_MANIFEST, () => false);
    expect(routes.map((route) => route.pattern)).toEqual(['/sign-in']);
    expect(problems).toHaveLength(10);
  });
});

describe('unlistedBuildRoutes', () => {
  it('names each page the build serves that the manifest has no implemented row for', () => {
    expect(unlistedBuildRoutes(['/', '/queue', '/secret'], ['/', '/queue'])).toEqual([
      '/secret: the build serves this page, but the route manifest has no implemented page row for it',
    ]);
  });

  it('is empty when the build and the manifest agree', () => {
    expect(unlistedBuildRoutes(['/queue'], ['/queue', '/sign-in'])).toEqual([]);
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
