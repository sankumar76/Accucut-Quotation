import { describe, expect, it } from 'vitest';

import { ROUTE_MANIFEST, type RouteRow } from '@/server/http/route-manifest';

import { CSRF_LOOP, EmptyLoopError, expectEveryCallRan, nonEmpty, refusedRoleCalls, SAME_403_LOOP, stateChangingCalls } from '../support/security-loops';

/**
 * QLT-64 (GitHub #81), STORY-01.04 AC-6: the per-route CSRF loop and the "same 403 for a real and an invented ID" loop of
 * `tests/security` must fail, not pass, when they have nothing to iterate over. These tests are the guard: they hand each
 * list builder a manifest with no route of its kind and require the failure, and they require both lists to be non-empty
 * for the real manifest, through the users routes.
 */

const page = (path: string): RouteRow => ({ path, kind: 'page', methods: ['GET'], roles: ['ADMIN'], status: 'implemented', stage: 'R1' });
const readOnlyApi: RouteRow = { path: '/api/v1/read-only', kind: 'api', methods: ['GET'], roles: ['ADMIN', 'LEAD', 'ENGINEER'], status: 'implemented', stage: 'R1' };
const plannedWriter: RouteRow = { path: '/api/v1/planned', kind: 'api', methods: ['POST'], roles: ['ADMIN'], status: 'planned', stage: 'R1' };
const publicWriter: RouteRow = { path: '/api/auth/own', kind: 'api', methods: ['POST'], roles: 'public', status: 'implemented', stage: 'R1' };
const everyoneAllowed = (): boolean => true;

describe('the CSRF loop cannot pass by finding nothing', () => {
  it.each([
    ['an empty manifest', []],
    ['a manifest of pages', [page('/queue')]],
    ['implemented API routes that change nothing', [readOnlyApi]],
    ['a state-changing route that is only planned', [plannedWriter]],
    ['a state-changing route that is public (it has its own protection)', [publicWriter]],
  ])('fails for %s', (_name, manifest) => {
    expect(() => stateChangingCalls(manifest)).toThrow(EmptyLoopError);
    expect(() => stateChangingCalls(manifest)).toThrow(CSRF_LOOP);
  });

  it('lists every state-changing method of the real manifest, and the users routes are in it', () => {
    const names = stateChangingCalls().map((call) => call.name);
    expect(names).toEqual(expect.arrayContaining(['POST /api/v1/users', 'PATCH /api/v1/users/[id]', 'POST /api/v1/users/[id]/password-reset']));
    expect(names.every((name) => !name.startsWith('GET '))).toBe(true);
  });
});

describe('the "same 403 for a real and an invented ID" loop cannot pass by finding nothing', () => {
  it.each([
    ['an empty manifest', []],
    ['a manifest of pages', [page('/users')]],
    ['implemented API routes that every role may call', [readOnlyApi]],
    ['only planned routes', [plannedWriter]],
    ['only public routes', [publicWriter]],
  ])('fails for %s', (_name, manifest) => {
    expect(() => refusedRoleCalls(everyoneAllowed, manifest)).toThrow(EmptyLoopError);
    expect(() => refusedRoleCalls(everyoneAllowed, manifest)).toThrow(SAME_403_LOOP);
  });

  it('fails when the table of roles refuses nobody on any route, even if the manifest does', () => {
    expect(() => refusedRoleCalls(everyoneAllowed)).toThrow(EmptyLoopError);
  });

  it('lists a Lead and an Engineer on each users route for the real manifest', () => {
    const adminOnly = (path: string, role: string): boolean => !path.startsWith('/api/v1/users') || role === 'ADMIN';
    const names = refusedRoleCalls(adminOnly).map((call) => call.name);
    for (const route of ['GET /api/v1/users', 'POST /api/v1/users', 'PATCH /api/v1/users/[id]', 'POST /api/v1/users/[id]/password-reset']) {
      expect(names).toContain(`${route} as LEAD`);
      expect(names).toContain(`${route} as ENGINEER`);
    }
    expect(names.some((name) => name.endsWith('as ADMIN'))).toBe(false);
  });

  it('the real manifest has implemented API routes for the loops to start from', () => {
    expect(ROUTE_MANIFEST.some((row) => row.kind === 'api' && row.status === 'implemented' && row.roles !== 'public')).toBe(true);
  });
});

describe('the helpers', () => {
  it('nonEmpty returns a list that has entries and names the loop when it has none', () => {
    expect(nonEmpty('x', [1, 2])).toEqual([1, 2]);
    expect(() => nonEmpty('my loop', [])).toThrow('"my loop"');
  });

  it('expectEveryCallRan fails when a loop body ran zero times, or fewer times than there were calls', () => {
    expect(() => expectEveryCallRan('x', 3, 3)).not.toThrow();
    expect(() => expectEveryCallRan('x', 0, 0)).toThrow(EmptyLoopError);
    expect(() => expectEveryCallRan('x', 0, 4)).toThrow(EmptyLoopError);
    expect(() => expectEveryCallRan('x', 2, 4)).toThrow('ran 2 times and should have run 4');
  });
});
