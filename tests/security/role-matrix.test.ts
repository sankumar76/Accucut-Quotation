import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { RoleName } from '@/lib/auth/roles';
import { allowsRole, ROUTE_MANIFEST, type HttpMethod, type RouteRow } from '@/server/http/route-manifest';

import { validCallFor, type ValidCall } from '../support/route-calls';
import { API_LOADERS, PAGE_LOADERS } from '../support/route-loaders';
import { expectEveryCallRan, refusedRoleCalls, SAME_403_LOOP } from '../support/security-loops';
import { harness, holdSessionClock, releaseSessionClock, SESSION_NOW, FORBIDDEN_SIGNAL, NOT_FOUND_SIGNAL, REDIRECT_PREFIX } from '../support/session-harness';

/**
 * STORY-01.02 AC-2 and AC-4 (SPEC section 14.1, NFR-001, BR-003): the role matrix. Every implemented route of the
 * manifest is called as an Admin, a Lead, an Engineer and a signed-out visitor, through the real `withRoute`, the real
 * session and the real page guard, over a fake user repository. The answers are compared with a table written out here
 * from SPEC sections 3 and 9, not with the manifest, so a wrong row fails the test instead of agreeing with itself.
 *
 *   - API route: signed out 401; a role the table does not allow 403 with a fixed body; an allowed role 200.
 *   - Page: signed out a redirect to sign-in; a role the table does not allow `forbidden()`; an allowed role renders.
 *   - The role check comes first: an invented ID and a real one give a refused role the same answer (CR-33).
 * A route with no loader (tests/support/route-loaders.ts) fails the test, so a story that adds a route also adds it here.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return {
    getAuthOptions: () => ({}),
    getUserRepository: () => shared.users,
    getUserService: () => shared.userService,
    getAuditService: () => shared.auditService,
    getMastersService: () => shared.mastersService,
  };
});

const ROLES: ReadonlyArray<RoleName> = ['ADMIN', 'LEAD', 'ENGINEER'];

/** What SPEC sections 3 and 9 say, written out (screen, then who may open it). */
const SPEC_ACCESS: Readonly<Record<string, ReadonlyArray<RoleName>>> = {
  '/queue': ['ADMIN', 'LEAD', 'ENGINEER'], // Dashboard and task queues: all (an Engineer sees their own)
  '/assign': ['ADMIN', 'LEAD'], // Assign task
  '/estimates/[code]': ['ADMIN', 'LEAD', 'ENGINEER'], // Estimate workspace: all, role-filtered
  '/estimates/[code]/costs/[slNo]': ['ADMIN', 'LEAD'], // Cost details
  '/estimates/[code]/export': ['ADMIN', 'LEAD'], // Excel export (FR-070)
  '/masters/process': ['ADMIN'], // Masters
  '/masters/customers': ['ADMIN'],
  '/masters/materials': ['ADMIN'],
  '/config/fields': ['ADMIN', 'LEAD'], // Field and formula configuration: Admin edits, Lead views
  '/config/checkpoints': ['ADMIN'], // Insert and delete fields, checkpoints: Admin
  '/users': ['ADMIN'], // Users
  '/settings': ['ADMIN'], // Settings
  '/audit': ['ADMIN'], // Audit log
  '/about': ['ADMIN', 'LEAD', 'ENGINEER'], // About: all
  // The API behind the Users screen (SPEC section 9: Users is the Admin's; architecture section 6 rows "Users" and "Reset user password").
  '/api/v1/users': ['ADMIN'],
  '/api/v1/users/[id]': ['ADMIN'],
  '/api/v1/users/[id]/password-reset': ['ADMIN'],
  // The API behind the Audit log screen (SPEC section 9: the audit log is the Admin's; architecture section 6 row "Audit", CR-33).
  '/api/v1/audit': ['ADMIN'],
  // The API behind the Process master screen (SPEC section 9: masters are the Admin's, BR-004; architecture section 6 row "Process items", CR-33).
  '/api/v1/process-items': ['ADMIN'],
  '/api/v1/process-items/[id]': ['ADMIN'],
  '/api/v1/materials': ['ADMIN'], '/api/v1/materials/[id]': ['ADMIN'], // the Materials tab of SCR-13: masters are the Admin's (BR-004), CR-33
  '/api/v1/exchange-rates': ['ADMIN'], // the Exchange rates tab (STORY-02.04): the Admin's alone; an Engineer never receives a rate (BR-003)
  '/api/v1/treatments': ['ADMIN'], '/api/v1/treatments/[id]': ['ADMIN'], // the Treatment / Color tab (STORY-02.05): the Admin's alone (BR-004)
};

/** Routes that are in no SPEC table: the shell and the account, open to everyone who is signed in. `/api/v1/options/materials` (STORY-02.03) is the safe list the estimate form chooses from: every role, no rate (architecture section 6 "Safe options"). */
const SIGNED_IN_ROUTES: ReadonlyArray<string> = ['/', '/design-system', '/api/v1/me', '/api/v1/options/materials', '/api/v1/options/treatments', '/account/password'];

/**
 * Routes that need no session (SPEC section 9, "Login"; next-auth's own endpoints), and the one test-only route (STORY-01.03 AC-4:
 * the negative control of the confidentiality scan, which answers 404 everywhere except under NODE_ENV=test and is in no role's list).
 */
const PUBLIC_ROUTES: ReadonlyArray<string> = ['/sign-in', '/api/auth/[...nextauth]', '/api/test-only/leak'];

function expectedRoles(path: string): ReadonlyArray<RoleName> {
  return SPEC_ACCESS[path] ?? ROLES;
}

const implemented = ROUTE_MANIFEST.filter((row) => row.status === 'implemented' && row.roles !== 'public');
const apiRows = implemented.filter((row) => row.kind === 'api');
const pageRows = implemented.filter((row) => row.kind === 'page');

/** `/estimates/[code]/costs/[slNo]` with a value for each segment. */
function fill(path: string, value: string): { readonly url: string; readonly params: Record<string, string> } {
  const params: Record<string, string> = {};
  const url = path.replace(/\[(?:\.\.\.)?([^\]]+)\]/g, (_match, name: string) => {
    params[name] = value;
    return value;
  });
  return { url, params };
}

/** Where a stale session on each page is sent. The queue is the home every person lands on, so it needs no return address. */
const RETURN_AFTER_STALE_SESSION: Readonly<Record<string, string>> = {
  '/': 'redirect:/sign-in?callbackUrl=%2F',
  '/queue': 'redirect:/sign-in',
  '/design-system': 'redirect:/sign-in?callbackUrl=%2Fdesign-system',
  '/users': 'redirect:/sign-in?callbackUrl=%2Fusers',
  '/audit': 'redirect:/sign-in?callbackUrl=%2Faudit',
  '/masters/process': 'redirect:/sign-in?callbackUrl=%2Fmasters%2Fprocess',
  '/masters/materials': 'redirect:/sign-in?callbackUrl=%2Fmasters%2Fmaterials',
};

const moduleShape = z.record(z.string(), z.unknown());

/** A call to the route: the ID goes into the path, and a body, when given, is sent as JSON. */
async function callApi(row: RouteRow, method: HttpMethod, id: string, body?: unknown): Promise<Response> {
  const loader = API_LOADERS[row.path];
  if (loader === undefined) throw new Error(`no loader for ${row.path}`);
  const handler = moduleShape.parse(await loader())[method];
  if (typeof handler !== 'function') throw new Error(`${row.path} exports no ${method}`);
  const { url, params } = fill(row.path, id);
  // A GET or HEAD request cannot carry a body.
  const hasBody = body !== undefined && method !== 'GET' && method !== 'HEAD';
  const request = new Request(`https://portal.example.test${url}`, {
    method,
    headers: { origin: 'https://portal.example.test', ...(hasBody ? { 'content-type': 'application/json' } : {}) },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });
  const answer: unknown = await handler(request, { params: Promise.resolve(params) });
  if (!(answer instanceof Response)) throw new Error(`${row.path} ${method} did not answer with a Response`);
  return answer;
}

/** The valid call for a route (an ID that exists, a body that passes), which the role it lists gets through. */
function validCall(row: RouteRow, method: HttpMethod): ValidCall {
  return validCallFor(method, row.path, { targetId: harness.targetId });
}

/** Calls the route with its valid ID and body. A refused role gets this call too: nothing about it may change the answer. */
function callValid(row: RouteRow, method: HttpMethod): Promise<Response> {
  const call = validCall(row, method);
  return callApi(row, method, call.id, call.body);
}

type PageOutcome = 'renders' | 'forbidden' | 'not-found' | `redirect:${string}`;

async function callPage(row: RouteRow, id: string): Promise<PageOutcome> {
  const loader = PAGE_LOADERS[row.path];
  if (loader === undefined) throw new Error(`no loader for ${row.path}`);
  const page = moduleShape.parse(await loader())['default'];
  if (typeof page !== 'function') throw new Error(`${row.path} has no default export`);
  const { params } = fill(row.path, id);
  try {
    await page({ params: Promise.resolve(params), searchParams: Promise.resolve({}) });
    return 'renders';
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === FORBIDDEN_SIGNAL) return 'forbidden';
    if (message === NOT_FOUND_SIGNAL) return 'not-found';
    if (message.startsWith(REDIRECT_PREFIX)) return `redirect:${message.slice(REDIRECT_PREFIX.length)}`;
    throw error;
  }
}

// Importing the pages (the design-system page pulls in a great many components) can take longer than a test's limit on a
// busy machine. The modules are loaded once, in a hook, whose limit is set for set-up work (test strategy section 10, DL-057).
beforeAll(async () => {
  holdSessionClock();
  await Promise.all([...Object.values(API_LOADERS), ...Object.values(PAGE_LOADERS)].map((load) => load()));
  await import('@/server/http/page-access');
});

afterAll(releaseSessionClock);

// A state-changing request is checked against the portal's own origin first, so the origin it came from is set.
beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', 'https://portal.example.test');
  harness.signInAs(null);
});

describe('AC-2: the manifest says what SPEC sections 3 and 9 say', () => {
  it('has a row for every screen of the SPEC table, a row for every infrastructure route, and no other', () => {
    const known = new Set([...Object.keys(SPEC_ACCESS), ...SIGNED_IN_ROUTES, ...PUBLIC_ROUTES]);
    expect(ROUTE_MANIFEST.map((row) => row.path).sort()).toEqual([...known].sort());
  });

  it('allows exactly the roles of the SPEC on each screen: 0 differences', () => {
    const differences = ROUTE_MANIFEST.filter((row) => row.roles !== 'public').flatMap((row) =>
      ROLES.filter((role) => allowsRole(row, role) !== expectedRoles(row.path).includes(role)).map((role) => `${row.path} as ${role}`),
    );
    expect(differences).toEqual([]);
  });

  it('keeps the public routes to sign-in, next-auth and the test-only negative control, and nothing else', () => {
    expect(ROUTE_MANIFEST.filter((row) => row.roles === 'public').map((row) => row.path).sort()).toEqual([...PUBLIC_ROUTES].sort());
  });

  it('gives an Engineer none of the Lead or Admin screens (BR-003)', () => {
    for (const path of ['/assign', '/estimates/[code]/costs/[slNo]', '/estimates/[code]/export', '/masters/process', '/masters/materials', '/config/fields', '/users', '/settings', '/audit']) {
      const row = ROUTE_MANIFEST.find((entry) => entry.path === path);
      expect(row !== undefined && allowsRole(row, 'ENGINEER'), path).toBe(false);
    }
  });
});

describe('every implemented route is in the matrix', () => {
  it('has a loader for each implemented API route and each implemented page', () => {
    expect(apiRows.map((row) => row.path).sort()).toEqual(Object.keys(API_LOADERS).sort());
    expect(pageRows.map((row) => row.path).sort()).toEqual(Object.keys(PAGE_LOADERS).sort());
  });
});

describe('AC-2 and AC-4: API routes, as each role and signed out', () => {
  const calls = apiRows.flatMap((row) => row.methods.filter((method) => method !== 'HEAD').map((method) => [row, method] as const));

  it.each(calls.map(([row, method]) => [`${method} ${row.path}`, row, method] as const))('%s: signed out gets 401 and a problem body', async (_name, row, method) => {
    harness.signInAs(null);
    const response = await callValid(row, method);
    expect(response.status).toBe(401);
    expect(response.headers.get('Content-Type')).toBe('application/problem+json');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it.each(calls.flatMap(([row, method]) => ROLES.map((role) => [`${method} ${row.path} as ${role}`, row, method, role] as const)))(
    '%s',
    async (_name, row, method, role) => {
      harness.signInAs(role);
      const response = await callValid(row, method);
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      if (expectedRoles(row.path).includes(role)) {
        expect(response.status).toBe(validCall(row, method).status);
      } else {
        expect(response.status).toBe(403);
        const { requestId, ...fixed } = z.record(z.string(), z.unknown()).parse(await response.json());
        expect(requestId).toMatch(/^req-[0-9a-f]{8}$/);
        expect(fixed).toEqual({ type: 'about:blank', title: 'You do not have access to this.', status: 403, code: 'FORBIDDEN' });
      }
    },
  );

  describe(`QLT-64: the "${SAME_403_LOOP}" loop`, () => {
    // Built from the manifest and the SPEC table, and it throws when empty, so this loop cannot pass by finding nothing.
    const refused = refusedRoleCalls((path, role) => expectedRoles(path).includes(role));

    it('has something to check, through the users routes, the audit route and the Process master routes: a Lead and an Engineer are refused on each of them', () => {
      const names = refused.map((call) => call.name);
      const routes = [
        'GET /api/v1/users',
        'POST /api/v1/users',
        'PATCH /api/v1/users/[id]',
        'POST /api/v1/users/[id]/password-reset',
        'GET /api/v1/audit',
        'GET /api/v1/process-items',
        'POST /api/v1/process-items',
        'PATCH /api/v1/process-items/[id]',
        'DELETE /api/v1/process-items/[id]',
      ];
      for (const route of routes) {
        expect(names, route).toEqual(expect.arrayContaining([`${route} as LEAD`, `${route} as ENGINEER`]));
      }
    });

    it('a refused role gets the same 403 for an invented ID and a real one, whatever was asked for', async () => {
      let ran = 0;
      for (const { row, method, role } of refused) {
        harness.signInAs(role);
        const valid = validCall(row, method);
        const answers = await Promise.all(
          ['00000000-0000-4000-8000-000000000000', harness.idOf.ADMIN, 'Q-2026-0001', valid.id].map(async (id) => {
            const response = await callApi(row, method, id, valid.body);
            const { requestId, ...fixed } = z.record(z.string(), z.unknown()).parse(await response.json());
            expect(requestId).toMatch(/^req-[0-9a-f]{8}$/);
            return { status: response.status, fixed };
          }),
        );
        expect(new Set(answers.map((answer) => JSON.stringify(answer))).size, `${method} ${row.path} as ${role}`).toBe(1);
        expect(answers[0]?.status).toBe(403);
        ran += 1;
      }
      expectEveryCallRan(SAME_403_LOOP, ran, refused.length);
    });

    it('is the same 403 with no body at all, and with a body that would not pass validation: the role is checked first', async () => {
      for (const { row, method, role } of refused) {
        harness.signInAs(role);
        const bare = await callApi(row, method, 'invented-id');
        const invalid = await callApi(row, method, 'invented-id', { unexpected: 'field' });
        expect([bare.status, invalid.status], `${method} ${row.path} as ${role}`).toEqual([403, 403]);
      }
    });
  });

  it('a person deactivated mid-session is refused at the next request (401), whatever their role', async () => {
    for (const role of ROLES) {
      harness.signInAs(role);
      const record = harness.users.records.find((candidate) => candidate.role === role);
      if (record === undefined) throw new Error('no such person');
      record.isActive = false;
      try {
        for (const [row, method] of calls) expect((await callValid(row, method)).status).toBe(401);
      } finally {
        record.isActive = true;
      }
    }
  });

  it('a session is 12 hours from sign-in on the held clock: refused at 12 hours and a second, accepted just before (STD-06)', async () => {
    const call = calls.find(([row]) => expectedRoles(row.path).includes('LEAD'));
    if (call === undefined) throw new Error('no API route a Lead may call');
    const [row, method] = call;
    harness.signInAs('LEAD');
    try {
      vi.setSystemTime(new Date(SESSION_NOW.getTime() + 12 * 3_600_000 - 1_000));
      expect((await callValid(row, method)).status).toBe(validCall(row, method).status);
      vi.setSystemTime(new Date(SESSION_NOW.getTime() + 12 * 3_600_000 + 1_000));
      expect((await callValid(row, method)).status).toBe(401);
    } finally {
      vi.setSystemTime(SESSION_NOW);
    }
  });

  it('a role change is seen at the next request: an Engineer made a Lead opens a Lead route at once', async () => {
    harness.signInAs('ENGINEER');
    const record = harness.users.records.find((candidate) => candidate.role === 'ENGINEER');
    if (record === undefined) throw new Error('no Engineer');
    try {
      for (const [row, method] of calls) {
        record.role = 'ENGINEER';
        const before = (await callValid(row, method)).status;
        record.role = 'LEAD';
        const after = (await callValid(row, method)).status;
        expect(before).toBe(expectedRoles(row.path).includes('ENGINEER') ? validCall(row, method).status : 403);
        expect(after).toBe(expectedRoles(row.path).includes('LEAD') ? validCall(row, method).status : 403);
      }
    } finally {
      record.role = 'ENGINEER';
    }
  });
});

describe('AC-2 and AC-4: pages, as each role and signed out', () => {
  it.each(pageRows.map((row) => [row.path, row] as const))('%s: signed out is sent to the sign-in page', async (_path, row) => {
    harness.signInAs(null);
    expect(await callPage(row, 'invented-id')).toBe('redirect:/sign-in');
  });

  it.each(pageRows.map((row) => [row.path, row] as const))('%s: a stale session keeps the address asked for', async (path, row) => {
    harness.signInAs(null);
    harness.recordReturnPath(path);
    try {
      const outcome = await callPage(row, 'invented-id');
      expect(outcome).toBe(RETURN_AFTER_STALE_SESSION[path]);
    } finally {
      harness.recordReturnPath(null);
    }
  });

  it.each(pageRows.flatMap((row) => ROLES.map((role) => [`${row.path} as ${role}`, row, role] as const)))('%s', async (_name, row, role) => {
    harness.signInAs(role);
    expect(await callPage(row, 'invented-id')).toBe(expectedRoles(row.path).includes(role) ? 'renders' : 'forbidden');
  });
});

describe('AC-2 and AC-4: the page guard on every page row, planned ones included', () => {
  /**
   * The implemented pages above are open to every role, so they cannot show a refusal. The guard reads the manifest row, not
   * the page file, so it is called here with the path of every page row (the Admin and Lead screens as well). The page that
   * arrives later calls it with the same path, and an architecture test makes sure it does.
   */
  const allPageRows = ROUTE_MANIFEST.filter((row) => row.kind === 'page' && row.roles !== 'public');

  it.each(allPageRows.flatMap((row) => ROLES.map((role) => [`${row.path} as ${role}`, row, role] as const)))('%s', async (_name, row, role) => {
    const { authorizePage } = await import('@/server/http/page-access');
    harness.signInAs(role);
    const outcome = await authorizePage(row.path).then(
      () => 'renders',
      (error: unknown) => (error instanceof Error ? error.message : 'unknown'),
    );
    expect(outcome).toBe(expectedRoles(row.path).includes(role) ? 'renders' : FORBIDDEN_SIGNAL);
  });

  it('refuses an Engineer on every Lead and Admin screen before the page reads anything', async () => {
    const { authorizePage } = await import('@/server/http/page-access');
    harness.signInAs('ENGINEER');
    const refused = allPageRows.filter((row) => !expectedRoles(row.path).includes('ENGINEER'));
    expect(refused.length).toBeGreaterThanOrEqual(10);
    for (const row of refused) await expect(authorizePage(row.path)).rejects.toThrow(FORBIDDEN_SIGNAL);
  });
});

describe('planned routes are not reachable', () => {
  it('has no loader and no route file for a planned row, so a request finds nothing to answer it', () => {
    const planned = ROUTE_MANIFEST.filter((row) => row.status === 'planned');
    expect(planned.length).toBeGreaterThan(0);
    for (const row of planned) {
      expect(API_LOADERS[row.path] ?? PAGE_LOADERS[row.path], row.path).toBeUndefined();
    }
  });
});
