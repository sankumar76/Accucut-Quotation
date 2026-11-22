import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { allowsRole, ROUTE_MANIFEST, type RouteRow } from '../../src/server/http/route-manifest';
import { EXEMPT_PAGES, OTHER_SIZES, SWEEP_ROWS, type ExemptPage, type SweepRow } from '../e2e-sweep/screens-table';

/**
 * STORY-10.08 AC-3 (guard, nothing left out): a page that is added to the route manifest later (EPIC-08, EPIC-09) must be in the sweep's table or in its exempt list, each exemption with a
 * written reason. This test runs in the required checks (`npx vitest run tests/unit`), while the sweep itself runs in the nightly job, so a page cannot join the portal and be missed by the
 * sweep without this test going red. `coverageProblems` is the whole rule, and the tests below run it on the real manifest and, to prove it can fail, on manifests with a page added, a role
 * missing, a stale row and an empty reason.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ALL_ROLES = ['ADMIN', 'LEAD', 'ENGINEER'] as const;
const MIN_REASON_LENGTH = 25;

const isSweptPage = (row: RouteRow): boolean => row.kind === 'page' && row.status === 'implemented' && row.testOnly !== true;

/** Every way the table and the exempt list can fail to describe the manifest's pages. An empty list is a pass. */
function coverageProblems(manifest: ReadonlyArray<RouteRow>, rows: ReadonlyArray<SweepRow>, exempt: ReadonlyArray<ExemptPage>): string[] {
  const problems: string[] = [];
  const pages = manifest.filter(isSweptPage);
  for (const page of pages) {
    const swept = rows.filter((row) => row.route === page.path);
    const exemption = exempt.find((entry) => entry.route === page.path);
    if (swept.length === 0 && exemption === undefined) problems.push(`${page.path} is in neither the sweep's table nor its exempt list`);
    if (swept.length > 0 && exemption !== undefined) problems.push(`${page.path} is both in the table and exempt`);
    if (page.roles === 'public') {
      if (swept.length > 0) problems.push(`${page.path} is public, and the sweep signs in as a role`);
      continue;
    }
    // Every role the manifest allows is walked, and no role it does not allow is.
    for (const role of ALL_ROLES.filter((candidate) => allowsRole(page, candidate)))
      if (swept.length > 0 && !swept.some((row) => row.roles.includes(role))) problems.push(`${page.path} is not swept as ${role}, which the manifest allows`);
    for (const row of swept) for (const role of row.roles) if (!allowsRole(page, role)) problems.push(`${page.path} is swept as ${role}, which the manifest does not allow`);
  }
  for (const row of rows) if (!pages.some((page) => page.path === row.route)) problems.push(`${row.route} is in the table and is not an implemented page of the manifest`);
  for (const entry of exempt) {
    if (!pages.some((page) => page.path === entry.route)) problems.push(`${entry.route} is exempt and is not an implemented page of the manifest`);
    if (entry.because.trim().length < MIN_REASON_LENGTH) problems.push(`${entry.route} is exempt without a written reason`);
  }
  return problems;
}

const page = (path: string, roles: RouteRow['roles']): RouteRow => ({ path, kind: 'page', methods: ['GET'], roles, status: 'implemented', stage: 'R1' });
const row = (route: string, roles: SweepRow['roles'], more: Partial<SweepRow> = {}): SweepRow => ({ route, screen: 'SCR-99 Invented', roles, primary: [], noPrimaryActionBecause: 'invented read-only page', ...more });

describe('AC-3: the sweep covers the route manifest', () => {
  it('finds no page of the real manifest that is missing, no role that is left out and no stale row', () => {
    expect(coverageProblems(ROUTE_MANIFEST, SWEEP_ROWS, EXEMPT_PAGES)).toEqual([]);
  });

  it('fails when a page is added to the manifest and is in neither the table nor the exempt list', () => {
    const later = [...ROUTE_MANIFEST, page('/reports', ['ADMIN'])];
    expect(coverageProblems(later, SWEEP_ROWS, EXEMPT_PAGES)).toEqual(["/reports is in neither the sweep's table nor its exempt list"]);
  });

  it('passes again when the page joins the table with a row, as an R2 screen does', () => {
    const later = [...ROUTE_MANIFEST, page('/reports', ['ADMIN'])];
    expect(coverageProblems(later, [...SWEEP_ROWS, row('/reports', ['ADMIN'])], EXEMPT_PAGES)).toEqual([]);
  });

  it('fails when a role that the manifest allows is not swept, and when a role it does not allow is', () => {
    const manifest = [page('/reports', ['ADMIN', 'LEAD'])];
    expect(coverageProblems(manifest, [row('/reports', ['ADMIN'])], [])).toEqual(['/reports is not swept as LEAD, which the manifest allows']);
    expect(coverageProblems(manifest, [row('/reports', ['ADMIN', 'LEAD', 'ENGINEER'])], [])).toEqual(['/reports is swept as ENGINEER, which the manifest does not allow']);
  });

  it('accepts a page that two rows cover between them (the review of a Lead and the form of an Engineer)', () => {
    const manifest = [page('/estimates/[code]', ['ADMIN', 'LEAD', 'ENGINEER'])];
    expect(coverageProblems(manifest, [row('/estimates/[code]', ['ADMIN', 'LEAD'], { variant: 'review' }), row('/estimates/[code]', ['ENGINEER'], { variant: 'form' })], [])).toEqual([]);
  });

  it('fails on a row whose page left the manifest, and on an exemption whose page left it', () => {
    expect(coverageProblems([], [row('/gone', ['ADMIN'])], [])).toEqual(['/gone is in the table and is not an implemented page of the manifest']);
    expect(coverageProblems([], [], [{ route: '/gone', because: 'this page was removed from the portal long ago' }])).toEqual(['/gone is exempt and is not an implemented page of the manifest']);
  });

  it('fails on an exemption with no real reason, and on a page that is both swept and exempt', () => {
    const manifest = [page('/sign-in', 'public'), page('/reports', ['ADMIN'])];
    const exempt = [{ route: '/sign-in', because: 'todo' }, { route: '/reports', because: 'a reason that is long enough to be a reason' }];
    expect(coverageProblems(manifest, [row('/reports', ['ADMIN'])], exempt)).toEqual(['/reports is both in the table and exempt', '/sign-in is exempt without a written reason']);
  });

  it('does not sweep a public page as a role', () => {
    expect(coverageProblems([page('/sign-in', 'public')], [row('/sign-in', ['ADMIN'])], [])).toContain('/sign-in is public, and the sweep signs in as a role');
  });
});

describe('AC-1, AC-3: the table itself', () => {
  it('has one row for each route and variant, and a variant on every route that has more than one row', () => {
    const keys = SWEEP_ROWS.map((entry) => `${entry.route}|${entry.variant ?? ''}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const entry of SWEEP_ROWS) {
      const sameRoute = SWEEP_ROWS.filter((other) => other.route === entry.route);
      if (sameRoute.length > 1) expect(entry.variant, `${entry.route} has more than one row`).toBeDefined();
    }
  });

  it('declares the primary actions of each page, or says why the page has none (a page is never left unexamined by omission)', () => {
    for (const entry of SWEEP_ROWS) {
      if (entry.primary.length === 0) expect((entry.noPrimaryActionBecause ?? '').trim().length, `${entry.route} has no action and no reason`).toBeGreaterThanOrEqual(MIN_REASON_LENGTH);
      else expect(entry.noPrimaryActionBecause, `${entry.route} has actions and a reason for having none`).toBeUndefined();
      for (const action of entry.primary) expect(action.kind === 'css' ? action.selector : action.name, `${entry.route} has an action with no name`).not.toBe('');
    }
  });

  it('names the estimate (calculated or draft) for every route that opens one', () => {
    for (const entry of SWEEP_ROWS.filter((candidate) => candidate.route.includes('[code]'))) expect(entry.estimate, `${entry.route} needs the seeded estimate it opens`).toBeDefined();
  });

  it('gives each reason that names a spec file a file that exists', () => {
    for (const entry of EXEMPT_PAGES) for (const file of entry.because.match(/tests\/e2e\/[\w.-]+\.spec\.ts/g) ?? []) expect(existsSync(`${ROOT}${file}`), `${entry.route} names ${file}`).toBe(true);
  });

  it('holds the other sizes of NFR-016: 1024x768, 1920x1080 and 360x800 turned on its side', () => {
    expect(OTHER_SIZES.map((size) => `${size.width}x${size.height}`)).toEqual(['1024x768', '1920x1080', '800x360']);
  });
});
