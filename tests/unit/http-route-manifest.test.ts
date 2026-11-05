import { describe, expect, it } from 'vitest';

import { HIDDEN_IN_PRODUCTION } from '../../scripts/lib/production-routes';
import { allowsRole, findPage, findRoute, ROUTE_MANIFEST, type RouteRow } from '@/server/http/route-manifest';

/**
 * STORY-01.02 AC-2 and AC-3: the shape rules of the manifest. What each role may open, set against SPEC sections 3 and 9,
 * is in `tests/security/role-matrix.test.ts`; which route files exist, in `manifest-completeness.test.ts`.
 */

describe('the shape of the manifest', () => {
  it('has one row per path, with at least one method', () => {
    const paths = ROUTE_MANIFEST.map((row) => row.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const row of ROUTE_MANIFEST) expect(row.methods.length).toBeGreaterThan(0);
  });

  it('writes a path the way Next.js does: a leading slash, no route group, no trailing slash', () => {
    for (const row of ROUTE_MANIFEST) {
      expect(row.path.startsWith('/')).toBe(true);
      expect(row.path).not.toMatch(/\(|\)|\/\//);
      if (row.path !== '/') expect(row.path.endsWith('/')).toBe(false);
    }
    expect(findRoute('/', 'GET')).toBeDefined();
  });

  it('keeps pages to GET, and API routes under /api', () => {
    for (const row of ROUTE_MANIFEST) {
      if (row.kind === 'page') {
        expect(row.methods).toEqual(['GET']);
        expect(row.path.startsWith('/api')).toBe(false);
      } else {
        expect(row.path.startsWith('/api/')).toBe(true);
      }
    }
  });

  it('lists only real roles, and never an empty list (a route nobody may open is a mistake)', () => {
    for (const row of ROUTE_MANIFEST) {
      if (row.roles === 'public') continue;
      expect(row.roles.length).toBeGreaterThan(0);
      for (const role of row.roles) expect(['ADMIN', 'LEAD', 'ENGINEER']).toContain(role);
    }
  });

  it('puts a menu entry only on a page with a fixed address', () => {
    for (const row of ROUTE_MANIFEST.filter((entry) => entry.nav !== undefined)) {
      expect(row.kind).toBe('page');
      expect(row.path).not.toContain('[');
    }
  });

  it('is frozen, so a stray write fails loudly', () => {
    expect(Object.isFrozen(ROUTE_MANIFEST)).toBe(true);
    expect(Object.isFrozen(ROUTE_MANIFEST[0])).toBe(true);
    const roles = ROUTE_MANIFEST.find((row) => row.roles !== 'public')?.roles;
    expect(Object.isFrozen(roles)).toBe(true);
  });

  it('hides only the design-system page in production, the same page the production-build checks expect to answer 404', () => {
    const hidden = ROUTE_MANIFEST.filter((row) => row.hiddenInProduction === true).map((row) => row.path);
    expect(hidden).toEqual(['/design-system']);
    expect(HIDDEN_IN_PRODUCTION.map((entry) => entry.route)).toEqual(hidden);
  });
});

describe('BR-003: the routes an Engineer can reach are named here, so adding one is a visible decision', () => {
  /**
   * Edit this list only when a story adds a route that an Engineer is meant to open, and name that story in the commit.
   * Every route listed has an allow-list response with no cost field (architecture section 6, "Engineer-reachable routes").
   */
  const ENGINEER_ROUTES = ['/', '/queue', '/design-system', '/api/v1/me', '/estimates/[code]', '/about', '/account/password'];

  it('matches exactly', () => {
    const reachable = ROUTE_MANIFEST.filter((row) => row.roles !== 'public' && allowsRole(row, 'ENGINEER')).map((row) => row.path);
    expect(reachable.sort()).toEqual([...ENGINEER_ROUTES].sort());
  });

  it('never lists an Engineer on a cost, export, master, configuration, user, setting or audit route', () => {
    const forbiddenWords = /cost|export|masters|config|users|settings|audit|assign/;
    for (const row of ROUTE_MANIFEST.filter((entry) => entry.roles !== 'public' && allowsRole(entry, 'ENGINEER'))) {
      expect(row.path, row.path).not.toMatch(forbiddenWords);
    }
  });
});

describe('lookups', () => {
  it('finds a row by path and method', () => {
    expect(findRoute('/api/v1/me', 'GET')?.kind).toBe('api');
    expect(findRoute('/api/v1/me', 'POST')).toBeUndefined();
    expect(findRoute('/missing', 'GET')).toBeUndefined();
  });

  it('finds a page row, and not an API row of the same path', () => {
    expect(findPage('/queue')?.screen).toBe('SCR-03');
    expect(findPage('/api/v1/me')).toBeUndefined();
  });

  it('allowsRole: a public row needs no role, a listed row lists its roles, deny by default', () => {
    const publicRow: RouteRow = { path: '/p', kind: 'page', methods: ['GET'], roles: 'public', status: 'implemented', stage: 'R1' };
    const adminRow: RouteRow = { ...publicRow, roles: ['ADMIN'] };
    expect(allowsRole(publicRow, 'ENGINEER')).toBe(true);
    expect(allowsRole(adminRow, 'ADMIN')).toBe(true);
    expect(allowsRole(adminRow, 'LEAD')).toBe(false);
    expect(allowsRole({ ...adminRow, roles: [] }, 'ADMIN')).toBe(false);
  });
});
