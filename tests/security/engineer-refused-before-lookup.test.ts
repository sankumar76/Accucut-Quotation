import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { RoleName } from '@/lib/auth/roles';
import { allowsRole, ROUTE_MANIFEST, type HttpMethod, type RouteRow } from '@/server/http/route-manifest';

import { forbiddenStrings, PROCESS_CANARY_RATES, SEED_RATE_SENTINELS } from '../support/canary-masters';
import { recipeProblem, validCallFor } from '../support/route-calls';
import { seedFormulaTexts } from '../support/seed-formula-texts';
import { API_LOADERS, PAGE_LOADERS } from '../support/route-loaders';
import { fixedForbiddenProblem, headersText, maskRequestId, scanResponse, type RecordedResponse } from '../support/scanner';
import { nonEmpty } from '../support/security-loops';
import { FORBIDDEN_SIGNAL, harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-01.03 AC-5 and AC-3, at the level where a lookup can be counted (CR-33; architecture section 6, "What a refused role gets";
 * STORY-02.01 AC-6, whose interim check this replaces). Every implemented route and page of the manifest that does not list a
 * role is called as that role (a Lead, an Engineer), with the canary masters in the rates:
 *   - an API route answers 403 with the fixed `problem+json` body, `Cache-Control: private, no-store`, no canary, no rate name;
 *   - a page raises `forbidden()` ("no access");
 *   - and NOTHING is looked up first: not a rate, not an audit entry, not a person but the caller (the session itself). The role
 *     check is the control, so a real ID and an invented one cannot give different answers, and a refusal cannot show that a
 *     record exists. The lookups are counted on the repositories, not assumed.
 * The routes come from the manifest, so a story that adds a Lead or Admin route is held to this with no edit (AC-6).
 * The live version, against the production build and a real database, is `tests/e2e/canary-scan.spec.ts`.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return {
    getAuthOptions: () => ({}),
    getUserRepository: () => shared.users,
    getUserService: () => shared.userService,
    getAuditService: () => shared.auditService,
    getMastersService: () => shared.mastersService,
    getTaskService: () => shared.taskService,
    getEstimateService: () => shared.estimateService,
    getConfigReadService: () => shared.configReadService,
    getAccountService: () => shared.accountService,
    getSessionCookieIssuer: () => shared.sessionCookieIssuer,
  };
});

const ORIGIN = 'https://portal.example.test';
const REFUSED_ROLES: ReadonlyArray<RoleName> = ['LEAD', 'ENGINEER'];
const INVENTED_ID = '00000000-0000-4000-8000-00000000dead';
// STORY-08.01: the formulas too, stored and as a person reads them, because the Configuration routes are the ones that hold them.
const FORBIDDEN = forbiddenStrings(seedFormulaTexts());
const moduleShape = z.record(z.string(), z.unknown());

/** Every implemented API call that the role does not list, for each refused role. Throws when there is none. */
function refusedApiCalls(): ReadonlyArray<{ readonly name: string; readonly row: RouteRow; readonly method: HttpMethod; readonly role: RoleName }> {
  const calls = ROUTE_MANIFEST.filter((row) => row.kind === 'api' && row.status === 'implemented' && row.roles !== 'public').flatMap((row) =>
    row.methods
      .filter((method) => method !== 'HEAD')
      .flatMap((method) =>
        REFUSED_ROLES.filter((role) => !allowsRole(row, role)).map((role) => ({ name: `${method} ${row.path} as ${role}`, row, method, role })),
      ),
  );
  return nonEmpty('API calls a Lead or an Engineer is refused', calls);
}

function refusedPages(): ReadonlyArray<{ readonly name: string; readonly row: RouteRow; readonly role: RoleName }> {
  const pages = ROUTE_MANIFEST.filter((row) => row.kind === 'page' && row.status === 'implemented' && row.roles !== 'public').flatMap((row) =>
    REFUSED_ROLES.filter((role) => !allowsRole(row, role)).map((role) => ({ name: `${row.path} as ${role}`, row, role })),
  );
  return nonEmpty('pages a Lead or an Engineer is refused', pages);
}

/** Puts the canary masters where a leak would find them: the 15 seed rates, and the three Process Master canary rates. */
function seedCanaryRates(): void {
  for (const record of harness.masters.records) {
    const sentinel = SEED_RATE_SENTINELS.find((rate) => rate.id === record.id);
    if (sentinel !== undefined) record.defaultValue = sentinel.value;
  }
  // The test's own rows are replaced, not added again, so each test starts from the same three.
  const ownIds = PROCESS_CANARY_RATES.map((_rate, index) => `00000000-0000-4000-8000-0004000c0${index}00`);
  harness.masters.records.splice(0, harness.masters.records.length, ...harness.masters.records.filter((record) => !ownIds.includes(record.id)));
  PROCESS_CANARY_RATES.forEach((rate, index) =>
    harness.masters.records.push({ id: ownIds[index] ?? '', name: rate.name, unit: rate.unit, defaultValue: rate.value }),
  );
}

function rowFor(path: string): RouteRow {
  const row = ROUTE_MANIFEST.find((candidate) => candidate.path === path);
  if (row === undefined) throw new Error(`no manifest row for ${path}`);
  return row;
}

/** Spies on every function of the repositories, except the one lookup the session itself makes (`findAccountById`). */
function watchLookups(): () => string[] {
  const spies: Array<readonly [string, ReturnType<typeof vi.spyOn>]> = [];
  const watch = (label: string, repository: object, allowed: ReadonlyArray<string> = []): void => {
    for (const [name, member] of Object.entries(repository)) {
      if (typeof member === 'function' && !allowed.includes(name))
        spies.push([`${label}.${name}`, vi.spyOn(repository as Record<string, never>, name as never)]);
    }
  };
  watch('masters', harness.masters);
  watch('audit', harness.auditWorld.audit);
  // STORY-08.01: the configuration versions, where the formulas are. A refused role must not cause a read of any of them.
  watch('config', harness.configRepository);
  watch('users', harness.users, ['findAccountById']);
  return () => spies.filter(([, spy]) => spy.mock.calls.length > 0).map(([name]) => name);
}

async function callApi(row: RouteRow, method: HttpMethod, id: string, body: unknown, query = ''): Promise<RecordedResponse> {
  const loader = API_LOADERS[row.path];
  if (loader === undefined) throw new Error(`no loader for ${row.path}`);
  const handler = moduleShape.parse(await loader())[method];
  if (typeof handler !== 'function') throw new Error(`${row.path} exports no ${method}`);
  const path = row.path.replace(/\[(?:\.\.\.)?[^\]]+\]/g, id);
  const params = Object.fromEntries([...row.path.matchAll(/\[(?:\.\.\.)?([^\]]+)\]/g)].map((match) => [match[1] ?? '', id]));
  const hasBody = body !== undefined && method !== 'GET';
  const request = new Request(`${ORIGIN}${path}${query}`, {
    method,
    headers: { origin: ORIGIN, ...(hasBody ? { 'content-type': 'application/json' } : {}) },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });
  const answer: unknown = await handler(request, { params: Promise.resolve(params) });
  if (!(answer instanceof Response)) throw new Error(`${row.path} ${method} did not answer with a Response`);
  return { label: `${method} ${path}`, url: `${ORIGIN}${path}`, status: answer.status, headers: Object.fromEntries(answer.headers), body: await answer.text() };
}

beforeAll(async () => {
  holdSessionClock();
  await Promise.all([...Object.values(API_LOADERS), ...Object.values(PAGE_LOADERS)].map((load) => load()));
});
afterAll(releaseSessionClock);
afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs(null);
  seedCanaryRates();
});

describe('AC-5: a refused role gets the fixed 403 and nothing is looked up first', () => {
  it.each(refusedApiCalls().map((call) => [call.name, call] as const))('%s', async (_name, { row, method, role }) => {
    harness.signInAs(role);
    const lookups = watchLookups();
    const real = validCallFor(method, row.path, { targetId: harness.targetId });
    // A dynamic row needs a real-value recipe, or "a real ID and an invented one" would be two invented IDs (QLT-08).
    expect(recipeProblem(row.path, real.id), row.path).toBeNull();
    const ids = row.path.includes('[') ? [real.id, INVENTED_ID] : [real.id];
    const answers = [];
    for (const id of ids) answers.push(await callApi(row, method, id, real.body));
    for (const answer of answers) {
      expect(fixedForbiddenProblem(answer), answer.label).toBeNull();
      expect(answer.headers['cache-control']).toBe('private, no-store');
      expect(scanResponse(answer, FORBIDDEN), answer.label).toEqual([]);
    }
    // The same answer for a real ID and an invented one, apart from the request ID: a refusal shows nothing about the record.
    if (answers.length === 2) expect(maskRequestId(answers[0]?.body ?? '')).toBe(maskRequestId(answers[1]?.body ?? ''));
    expect(lookups()).toEqual([]);
  });

  it.each(refusedPages().map((page) => [page.name, page] as const))('page %s: "no access" before anything is read', async (_name, { row, role }) => {
    harness.signInAs(role);
    const lookups = watchLookups();
    const loader = PAGE_LOADERS[row.path];
    if (loader === undefined) throw new Error(`no loader for ${row.path}`);
    const page = moduleShape.parse(await loader())['default'];
    if (typeof page !== 'function') throw new Error(`${row.path} has no default export`);
    const params = Object.fromEntries([...row.path.matchAll(/\[(?:\.\.\.)?([^\]]+)\]/g)].map((match) => [match[1] ?? '', INVENTED_ID]));
    await expect(page({ params: Promise.resolve(params), searchParams: Promise.resolve({}) })).rejects.toThrow(FORBIDDEN_SIGNAL);
    expect(lookups()).toEqual([]);
  });

  it('the counting can fail: an allowed role does make the lookups, and they are seen', async () => {
    harness.signInAs('ADMIN');
    const lookups = watchLookups();
    expect((await callApi(rowFor('/api/v1/process-items'), 'GET', INVENTED_ID, undefined)).status).toBe(200);
    expect(lookups()).toContain('masters.listProcessItems');
  });

  it('a signed-out caller is sent 401 and no rate, on every route', async () => {
    harness.signInAs(null);
    const lookups = watchLookups();
    for (const { row, method } of refusedApiCalls()) {
      const answer = await callApi(row, method, INVENTED_ID, validCallFor(method, row.path, { targetId: harness.targetId }).body);
      expect(answer.status, answer.label).toBe(401);
      expect(scanResponse(answer, FORBIDDEN), answer.label).toEqual([]);
    }
    expect(lookups()).toEqual([]);
  });
});

describe('AC-3: what an Engineer may call sends no Restricted value', () => {
  it('every API route the manifest lists for the Engineer answers without a canary, a rate name or a formula marker', async () => {
    harness.signInAs('ENGINEER');
    const rows = nonEmpty(
      'Engineer-reachable API routes',
      ROUTE_MANIFEST.filter((row) => row.kind === 'api' && row.status === 'implemented' && row.roles !== 'public' && allowsRole(row, 'ENGINEER')),
    );
    for (const row of rows) {
      for (const method of row.methods.filter((candidate) => candidate !== 'HEAD')) {
        const call = validCallFor(method, row.path, { targetId: harness.targetId });
        const answer = await callApi(row, method, call.id, call.body, call.query);
        expect(answer.status, answer.label).toBeLessThan(500);
        expect(scanResponse(answer, FORBIDDEN), answer.label).toEqual([]);
        expect(headersText(answer.headers)).not.toContain('771.37');
      }
    }
  });

  it('the control: the Admin is sent the canary rates by the same routes, so the scan has something to find', async () => {
    harness.signInAs('ADMIN');
    const answer = await callApi(rowFor('/api/v1/process-items'), 'GET', INVENTED_ID, undefined);
    expect(answer.status).toBe(200);
    const found = new Set(scanResponse(answer, FORBIDDEN).map((finding) => finding.found));
    for (const rate of PROCESS_CANARY_RATES) {
      expect(found.has(rate.value), rate.name).toBe(true);
    }
    for (const rate of SEED_RATE_SENTINELS) expect(found.has(rate.value), rate.name).toBe(true);
    expect(found.has(PROCESS_CANARY_RATES[0]?.name ?? '')).toBe(true);
  });
});
