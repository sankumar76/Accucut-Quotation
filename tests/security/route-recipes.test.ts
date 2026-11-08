import { describe, expect, it } from 'vitest';

import { ROUTE_MANIFEST, type RouteRow } from '@/server/http/route-manifest';

import { NO_RECIPE_ID, recipeProblem, rowsWithoutRecipe, validCallFor, validPageAddress } from '../support/route-calls';

/**
 * STORY-01.03 AC-6 (G6 QLT-02, QLT-08): the scan and the CR-33 loops open a route with a dynamic segment with the ID of a record that
 * really exists, never with an invented one. With an invented ID the scan would see only a 404 or "no access" and stay green, and "a real
 * ID and an invented one" would be the same ID. So a dynamic route with no real-value recipe in `tests/support/route-calls.ts` is a failure
 * with a message that names the route, here and in the live scan. No Engineer route with a dynamic segment is implemented yet; the
 * checks below show that the rule fires on one, and that every dynamic route that does exist has its recipe.
 */

const CONTEXT = { targetId: '00000000-0000-4000-8000-0000000000aa' };

const plantedRow = (overrides: Partial<RouteRow>): RouteRow => ({
  path: '/estimates/[code]',
  kind: 'page',
  methods: ['GET'],
  roles: ['ADMIN', 'LEAD', 'ENGINEER'],
  status: 'implemented',
  stage: 'R1',
  ...overrides,
});

describe('a dynamic route needs a real-value recipe (AC-6)', () => {
  it('every implemented route of the manifest that has a dynamic segment has one', () => {
    expect(rowsWithoutRecipe(ROUTE_MANIFEST, CONTEXT)).toEqual([]);
  });

  it('the manifest does have dynamic routes with recipes, so the check above is not empty', () => {
    const dynamic = ROUTE_MANIFEST.filter((row) => row.status === 'implemented' && row.kind === 'api' && row.roles !== 'public' && row.path.includes('['));
    expect(dynamic.length).toBeGreaterThan(0);
    for (const row of dynamic)
      for (const method of row.methods) expect(validCallFor(method, row.path, CONTEXT).id, `${method} ${row.path}`).not.toBe(NO_RECIPE_ID);
  });

  it('a planted Engineer page with a dynamic segment and no recipe is named (the scan would see only "no access")', () => {
    expect(rowsWithoutRecipe([...ROUTE_MANIFEST, plantedRow({})], CONTEXT)).toEqual([
      'page /estimates/[code]: add a real-value recipe for /estimates/[code] to tests/support/route-calls.ts (AC-6)',
    ]);
  });

  it('a planted Engineer API route with a dynamic segment and no recipe is named, for each method', () => {
    const planted = plantedRow({ path: '/api/v1/tasks/[id]', kind: 'api', methods: ['GET', 'PATCH'] });
    expect(rowsWithoutRecipe([planted], CONTEXT)).toEqual([
      'GET /api/v1/tasks/[id]: add a real-value recipe for /api/v1/tasks/[id] to tests/support/route-calls.ts (AC-6)',
      'PATCH /api/v1/tasks/[id]: add a real-value recipe for /api/v1/tasks/[id] to tests/support/route-calls.ts (AC-6)',
    ]);
  });

  it('a planned row, a public row, a hidden review page and a fixed address need none', () => {
    const rows = [plantedRow({ status: 'planned' }), plantedRow({ roles: 'public' }), plantedRow({ hiddenInProduction: true }), plantedRow({ path: '/queue' })];
    expect(rowsWithoutRecipe(rows, CONTEXT)).toEqual([]);
  });
});

describe('the helpers behind it', () => {
  it('recipeProblem: only a dynamic path that still carries the placeholder ID has a problem', () => {
    expect(recipeProblem('/api/v1/users/[id]', NO_RECIPE_ID)).toContain('add a real-value recipe');
    expect(recipeProblem('/api/v1/users/[id]', CONTEXT.targetId)).toBeNull();
    expect(recipeProblem('/api/v1/me', NO_RECIPE_ID)).toBeNull();
  });

  it('validPageAddress: a fixed address is itself, a dynamic one without a recipe throws', () => {
    expect(validPageAddress('/queue', { ownerId: CONTEXT.targetId })).toBe('/queue');
    expect(() => validPageAddress('/estimates/[code]', { ownerId: CONTEXT.targetId })).toThrow(/add a real-value recipe for \/estimates\/\[code\]/);
  });
});
