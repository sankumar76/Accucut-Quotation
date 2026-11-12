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

  it('has one test-only row, the negative control of the confidentiality scan: public, GET only, no menu entry (STORY-01.03 AC-4, assumption A-2)', () => {
    const testOnly = ROUTE_MANIFEST.filter((row) => row.testOnly === true);
    expect(testOnly.map((row) => row.path)).toEqual(['/api/test-only/leak']);
    for (const row of testOnly) {
      expect(row.roles).toBe('public');
      expect(row.methods).toEqual(['GET']);
      expect(row.kind).toBe('api');
      expect(row.nav).toBeUndefined();
    }
    // Being public it is in no role's list, so the Engineer-reachable set below never holds it and the scan never treats it as one.
    expect(ROUTE_MANIFEST.filter((row) => row.roles !== 'public' && row.testOnly === true)).toEqual([]);
  });

  it('hides only the design-system page in production, the same page the production-build checks expect to answer 404', () => {
    const hidden = ROUTE_MANIFEST.filter((row) => row.hiddenInProduction === true).map((row) => row.path);
    expect(hidden).toEqual(['/design-system']);
    expect(HIDDEN_IN_PRODUCTION.map((entry) => entry.route)).toEqual(hidden);
  });
});

describe('STORY-01.05 AC-5, QLT-06: the routes open to a person who must set a new password are named here', () => {
  it('are exactly the account page and the change of the password, and no other row carries the flag', () => {
    expect(ROUTE_MANIFEST.filter((row) => row.mustChangeAllowed === true).map((row) => `${row.kind} ${row.path}`)).toEqual([
      'page /account',
      'api /api/v1/account/password',
    ]);
  });

  it('both are open to every role, so the change can be made by whoever is told to', () => {
    for (const row of ROUTE_MANIFEST.filter((entry) => entry.mustChangeAllowed === true)) {
      expect(row.roles, row.path).toEqual(['ADMIN', 'LEAD', 'ENGINEER']);
    }
  });
});

describe('BR-003: the routes an Engineer can reach are named here, so adding one is a visible decision', () => {
  /**
   * Edit this list only when a story adds a route that an Engineer is meant to open, and name that story in the commit.
   * Every route listed has an allow-list response with no cost field (architecture section 6, "Engineer-reachable routes").
   */
  // `/account` and `/api/v1/account/password` are STORY-01.05's: the person's own name, e-mail and role, and the change of their own password (a 204 with no body).
  // `/api/v1/options/materials` is STORY-02.03's: IDs, names and Material Considered through one strict schema, no rate of any kind (AC-4); `/api/v1/options/treatments` is STORY-02.05's: IDs and names (AC-5).
  const ENGINEER_ROUTES = ['/', '/queue', '/design-system', '/api/v1/me', '/api/v1/options/materials', '/api/v1/options/treatments', '/estimates/[code]', '/about', '/account', '/api/v1/account/password'];

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
