import { describe, expect, it } from 'vitest';

import type { RoleName } from '@/lib/auth/roles';
import { groupNavigation, navigationFor } from '@/server/http/navigation';
import { ROUTE_MANIFEST, type RouteRow } from '@/server/http/route-manifest';

/**
 * STORY-01.02 AC-6: the menu lists only the rows that are menu entries, implemented and allowed for the role, from the
 * same manifest that decides access. An Engineer sees no Admin or Lead item, not even a disabled one.
 */

const ROLES: ReadonlyArray<RoleName> = ['ADMIN', 'LEAD', 'ENGINEER'];

function labels(role: RoleName, includeHiddenInProduction = true, manifest?: ReadonlyArray<RouteRow>): string[] {
  return navigationFor(role, { includeHiddenInProduction, ...(manifest === undefined ? {} : { manifest }) }).map((entry) => entry.label);
}

describe('the menu of each role, from the manifest as it is now', () => {
  it.each(ROLES)('%s sees the implemented entries and no planned one', (role) => {
    // Only pages that exist are listed: planned pages (Assign task, Masters, Users ...) appear when their stories land.
    // Users (STORY-01.04) and the Audit log (STORY-01.07) are the Admin's alone, under Administration, before the Review group:
    // a Lead and an Engineer are never shown them, not even disabled.
    const administration = role === 'ADMIN' ? ['Users', 'Audit log'] : [];
    expect(labels(role)).toEqual([role === 'ENGINEER' ? 'My tasks' : 'Task queue', 'Home', ...administration, 'Design system']);
  });

  it('a production build does not list the design-system page', () => {
    expect(labels('ADMIN', false)).toEqual(['Task queue', 'Home', 'Users', 'Audit log']);
  });

  it('every entry has a fixed address, a label and an icon, and an address that is a page of the manifest', () => {
    const pages = new Set(ROUTE_MANIFEST.filter((row) => row.kind === 'page').map((row) => row.path));
    for (const role of ROLES) {
      for (const entry of navigationFor(role, { includeHiddenInProduction: true })) {
        expect(pages.has(entry.href)).toBe(true);
        expect(entry.href).not.toContain('[');
        expect(entry.label.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('the menu once the planned pages exist (every row switched to implemented)', () => {
  const everythingBuilt: ReadonlyArray<RouteRow> = ROUTE_MANIFEST.map((row) => ({ ...row, status: 'implemented' }));

  it('an Admin sees every group of SCR-25, in its order', () => {
    const groups = groupNavigation(navigationFor('ADMIN', { includeHiddenInProduction: false, manifest: everythingBuilt }));
    expect(groups.map((group) => group.label)).toEqual(['Work', 'Masters', 'Configuration', 'Administration', 'Help']);
    expect(groups.find((group) => group.label === 'Administration')?.items.map((item) => item.label)).toEqual(['Users', 'Settings', 'Audit log']);
    expect(groups.find((group) => group.label === 'Masters')?.items.map((item) => item.label)).toEqual(['Process master', 'Customers', 'Materials and lists']);
  });

  it('a Lead sees Assign task and the formulas, and no Admin item', () => {
    const lead = labels('LEAD', false, everythingBuilt);
    expect(lead).toContain('Assign task');
    expect(lead).toContain('Fields and formulas');
    for (const adminOnly of ['Process master', 'Customers', 'Materials and lists', 'Checkpoints', 'Users', 'Settings', 'Audit log']) {
      expect(lead).not.toContain(adminOnly);
    }
  });

  it('an Engineer sees their tasks, Home and About, and no Admin or Lead item, not even a disabled one (AC-6)', () => {
    const engineer = labels('ENGINEER', false, everythingBuilt);
    expect(engineer).toEqual(['My tasks', 'Home', 'About']);
  });
});

describe('what keeps an entry out', () => {
  const page = (overrides: Partial<RouteRow>): RouteRow => ({
    path: '/example',
    kind: 'page',
    methods: ['GET'],
    roles: ['ADMIN'],
    status: 'implemented',
    stage: 'R1',
    nav: { group: 'Work', label: 'Example', order: 1, icon: 'house' },
    ...overrides,
  });

  it('lists a row that is implemented, allowed and has nav', () => {
    expect(labels('ADMIN', false, [page({})])).toEqual(['Example']);
  });

  it('leaves out a planned row', () => {
    expect(labels('ADMIN', false, [page({ status: 'planned' })])).toEqual([]);
  });

  it('leaves out an API route, even one that carries nav', () => {
    expect(labels('ADMIN', false, [page({ kind: 'api' })])).toEqual([]);
  });

  it('leaves out a row with no nav', () => {
    const withoutNav: RouteRow = { path: '/example', kind: 'page', methods: ['GET'], roles: ['ADMIN'], status: 'implemented', stage: 'R1' };
    expect(labels('ADMIN', false, [withoutNav])).toEqual([]);
  });

  it('leaves out a row the role is not listed on', () => {
    expect(labels('LEAD', false, [page({})])).toEqual([]);
    expect(labels('ENGINEER', false, [page({})])).toEqual([]);
  });

  it('orders by group, then by the order given, not by the manifest order', () => {
    const rows = [
      page({ path: '/b', nav: { group: 'Help', label: 'B', order: 1, icon: 'info' } }),
      page({ path: '/a2', nav: { group: 'Work', label: 'A2', order: 20, icon: 'house' } }),
      page({ path: '/a1', nav: { group: 'Work', label: 'A1', order: 10, icon: 'house' } }),
    ];
    expect(labels('ADMIN', false, rows)).toEqual(['A1', 'A2', 'B']);
  });
});
