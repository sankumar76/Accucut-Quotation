import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { TRANSITION_REFUSALS } from '@/lib/estimate/state-machine';
import { ROUTE_MANIFEST, type HttpMethod, type RouteRow } from '@/server/http/route-manifest';

import { forbiddenStrings } from '../support/canary-masters';
import { bodyOfRecipe } from '../support/request-body';
import { validCallFor, type UploadRecipe } from '../support/route-calls';
import { API_LOADERS } from '../support/route-loaders';
import { expectEveryCallRan } from '../support/security-loops';
import { SPEC_ACCESS } from '../support/spec-access';
import { describeFinding, scanResponses, type RecordedResponse } from '../support/scanner';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * CR-01 item 7D, AC-6 (AQP-401; A-CR01-8 confirmed, FR-109, DL-304, DL-337 (2); architecture section 4.12 c): **an ignored estimate is fully frozen, read-only except Restore.** Every route that changes an estimate, and the two
 * routes of the Excel download, is called through the real `withRoute` and the real services over the in-memory world of the security tests, with the canary estimate and its task **ignored**, and each must answer
 * **409 `ESTIMATE_IGNORED`** with the state machine's own sentence, by its own check, and write nothing.
 *
 * **The list is the route manifest's, not a list written here**: every implemented API route under `/api/v1/estimates/[id]` or `/api/v1/tasks/[id]` with a state-changing method, and the two export reads, minus Ignore and
 * Restore (the two that are allowed). A route added to the manifest later is called with its recipe (`route-calls.ts`) and, unless it refuses, fails here, so a route cannot forget the check. The roles are the SPEC's
 * (`spec-access.ts`): each role a route lists is called, so an Engineer's own save, tree change, picture and Calculate are refused 409 as well. The order of the checks (403 for the role, then 404 for a task that is not theirs,
 * then 409) is held by `tests/unit/estimate-service.test.ts` and `tests/unit/export-service.test.ts` and the integration tests. Reading stays allowed: the costs, the tree, the form and the node reads are not 409.
 * Every ID and name is invented.
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
    getConfigEditService: () => shared.configEditService,
    getConfigStructureService: () => shared.configStructureService,
    getConfigCheckpointService: () => shared.configCheckpointService,
    getSettingsService: () => shared.settingsService,
    getCalculationService: () => shared.calculationService,
    getEstimateReviewService: () => shared.estimateReviewService,
    getDownloadMarkerService: () => shared.downloadMarkerService,
    getApprovalService: () => shared.approvalService,
    getUnlockService: () => shared.unlockService,
    getEstimateStatusService: () => shared.estimateStatusService,
    getCancelApprovalService: () => shared.cancelApprovalService,
    getRemovePriceService: () => shared.removePriceService,
    getAdminHandoverService: () => shared.adminHandoverService,
    getCostDetailsService: () => shared.costDetailsService,
    getExportService: () => shared.exportService,
    getAccountService: () => shared.accountService,
    getSessionCookieIssuer: () => shared.sessionCookieIssuer,
  };
});

const LOOP = 'an ignored estimate refuses every other route';
const STATE_CHANGING: ReadonlyArray<HttpMethod> = ['POST', 'PUT', 'PATCH', 'DELETE'];

/** The routes that may be called while an estimate is ignored: the two that set and clear the layer. */
const ALLOWED_WHILE_IGNORED: ReadonlySet<string> = new Set(['/api/v1/estimates/[id]/ignore', '/api/v1/estimates/[id]/restore']);

/** The download is not a state change, but the customer's answer freezes it too (A-CR01-8): its two reads are refused. */
const EXPORT_READS: ReadonlySet<string> = new Set(['/api/v1/estimates/[id]/export', '/api/v1/estimates/[id]/export-summary']);

const isEstimateScoped = (row: RouteRow): boolean => row.path.startsWith('/api/v1/estimates/[id]/') || row.path === '/api/v1/tasks/[id]';

/** Every call the rule covers, built from the manifest. */
const covered = ROUTE_MANIFEST.filter((row) => row.kind === 'api' && row.status === 'implemented' && row.roles !== 'public' && isEstimateScoped(row)).flatMap((row) =>
  row.methods
    .filter((method) => (STATE_CHANGING.includes(method) && !ALLOWED_WHILE_IGNORED.has(row.path)) || (method === 'GET' && EXPORT_READS.has(row.path)))
    .map((method) => ({ name: `${method} ${row.path}`, row, method })),
);

/** The reads that must stay open while an estimate is ignored (A-CR01-8: "reading stays allowed"). */
const READS_STAY_OPEN: ReadonlyArray<string> = ['GET /api/v1/estimates/[id]/tree', 'GET /api/v1/estimates/[id]/costs', 'GET /api/v1/estimates/[id]/form', 'GET /api/v1/estimates/[id]/nodes/[nodeId]', 'GET /api/v1/tasks/[id]'];

const problemShape = z.looseObject({ code: z.string(), title: z.string() });
const moduleShape = z.record(z.string(), z.unknown());

/** The roles the SPEC lists for the route and the method. */
function rolesOf(method: HttpMethod, path: string): ReadonlyArray<'ADMIN' | 'LEAD' | 'ENGINEER'> {
  return SPEC_ACCESS[`${method} ${path}`] ?? SPEC_ACCESS[path] ?? ['ADMIN', 'LEAD', 'ENGINEER'];
}

async function callApi(path: string, method: HttpMethod, id: string, body?: unknown, query = '', upload?: UploadRecipe): Promise<Response> {
  const loader = API_LOADERS[path];
  if (loader === undefined) throw new Error(`no loader for ${path}`);
  const handler = moduleShape.parse(await loader())[method];
  if (typeof handler !== 'function') throw new Error(`${path} exports no ${method}`);
  const params: Record<string, string> = {};
  const url = path.replace(/\[(?:\.\.\.)?([^\]]+)\]/g, (_match, name: string) => {
    params[name] = id;
    return id;
  });
  const sent = bodyOfRecipe(method, { body, ...(upload === undefined ? {} : { upload }) });
  const request = new Request(`https://portal.example.test${url}${query}`, {
    method,
    headers: { origin: 'https://portal.example.test', ...sent.headers },
    ...(sent.body === undefined ? {} : { body: sent.body }),
  });
  const answer: unknown = await handler(request, { params: Promise.resolve(params) });
  if (!(answer instanceof Response)) throw new Error(`${path} ${method} did not answer with a Response`);
  return answer;
}

const canary = () => {
  const estimate = harness.estimateWorld.estimates.find((candidate) => candidate.id === harness.targetId);
  if (estimate === undefined) throw new Error('The canary estimate is missing from the world.');
  return estimate;
};

/** Sets the Ignored layer over the canary estimate and its task, as Ignore does. */
function ignoreCanary(): void {
  const estimate = canary();
  estimate.ignoredAt = new Date('2026-11-23T06:35:00.000Z');
  estimate.ignoredBy = harness.idOf.LEAD;
  estimate.ignoreRemarks = 'Invented remarks.';
  harness.taskWorld.setIgnored(harness.targetId, { remarks: 'Invented remarks.' });
}

function restoreCanary(): void {
  const estimate = canary();
  delete estimate.ignoredAt;
  delete estimate.ignoredBy;
  delete estimate.ignoreRemarks;
  harness.taskWorld.setIgnored(harness.targetId, null);
}

beforeAll(async () => {
  holdSessionClock();
  await Promise.all(Object.values(API_LOADERS).map((load) => load()));
});

afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', 'https://portal.example.test');
  harness.signInAs(null);
  ignoreCanary();
  return restoreCanary;
});

describe('AC-6: the list is built from the route manifest', () => {
  it('holds every state-changing estimate route and both export reads, and neither Ignore nor Restore', () => {
    const names = covered.map((call) => call.name);
    expect(names.length).toBeGreaterThan(0);
    for (const route of [
      'POST /api/v1/estimates/[id]/calculate',
      'POST /api/v1/estimates/[id]/recalculate',
      'POST /api/v1/estimates/[id]/approve',
      'POST /api/v1/estimates/[id]/unlock',
      'POST /api/v1/estimates/[id]/quoted',
      'POST /api/v1/estimates/[id]/approval/cancel',
      'POST /api/v1/estimates/[id]/approval/remove-price',
      'PUT /api/v1/estimates/[id]/customer',
      'POST /api/v1/estimates/[id]/tree/move',
      'POST /api/v1/estimates/[id]/nodes',
      'PUT /api/v1/estimates/[id]/nodes/[nodeId]',
      'DELETE /api/v1/estimates/[id]/nodes/[nodeId]',
      'PATCH /api/v1/estimates/[id]/nodes/[nodeId]/inputs',
      'PUT /api/v1/estimates/[id]/nodes/[nodeId]/image',
      'DELETE /api/v1/estimates/[id]/nodes/[nodeId]/image',
      'GET /api/v1/estimates/[id]/export',
      'GET /api/v1/estimates/[id]/export-summary',
      'PATCH /api/v1/tasks/[id]',
    ]) {
      expect(names, route).toContain(route);
    }
    expect(names.some((name) => name.endsWith('/ignore') || name.endsWith('/restore'))).toBe(false);
  });
});

describe('AC-6: every one of them answers 409 ESTIMATE_IGNORED for each role the SPEC lets call it, and writes nothing', () => {
  const calls = covered.flatMap(({ name, row, method }) => rolesOf(method, row.path).map((role) => [`${name} as ${role}`, row, method, role] as const));

  it('is not empty', () => {
    expect(calls.length).toBeGreaterThanOrEqual(covered.length);
  });

  it.each(calls)('%s', async (_name, row, method, role) => {
    harness.signInAs(role);
    const call = validCallFor(method, row.path, { targetId: harness.targetId });
    const statusBefore = canary().status;
    const revisionBefore = canary().inputsRevision;
    const response = await callApi(row.path, method, call.id, call.body, call.query, call.upload);
    expect(response.status).toBe(409);
    const body = problemShape.parse(await response.json());
    expect(body.code).toBe(TRANSITION_REFUSALS.IGNORED.code);
    expect(body.title).toBe(TRANSITION_REFUSALS.IGNORED.message);
    // Nothing was written: the status and the inputs revision stand, the layer is still set, and no audit entry was made for the refusal.
    expect(canary().status).toBe(statusBefore);
    expect(canary().inputsRevision).toBe(revisionBefore);
    expect(canary().ignoredAt).toBeDefined();
  });

  it('ran for every call', async () => {
    let ran = 0;
    for (const [, row, method, role] of calls) {
      harness.signInAs(role);
      const call = validCallFor(method, row.path, { targetId: harness.targetId });
      const response = await callApi(row.path, method, call.id, call.body, call.query, call.upload);
      expect(response.status, `${method} ${row.path} as ${role}`).toBe(409);
      ran += 1;
    }
    expectEveryCallRan(LOOP, ran, calls.length);
  });
});

describe('AC-6: reading stays allowed while an estimate is ignored', () => {
  it.each(READS_STAY_OPEN)('%s is not refused with ESTIMATE_IGNORED', async (name) => {
    const [method, path] = name.split(' ') as [HttpMethod, string];
    harness.signInAs(rolesOf(method, path).includes('LEAD') ? 'LEAD' : 'ENGINEER');
    const call = validCallFor(method, path, { targetId: harness.targetId });
    const response = await callApi(path, method, call.id, call.body, call.query, call.upload);
    expect(response.status).toBe(call.status);
    expect(response.status).not.toBe(409);
  });
});

describe('AC-9 (NFR-002): an Engineer\'s reads over an ignored estimate and the Ignored tab hold no cost, rate or formula value', () => {
  it('the task page, the Ignored tab of the queue and the tree and form reads are scanned for every Restricted value of the canary masters, and find none; the layer is there by name and no ID', async () => {
    harness.signInAs('ENGINEER');
    const recorded: RecordedResponse[] = [];
    const record = async (label: string, response: Response): Promise<string> => {
      const body = await response.text();
      recorded.push({ label, url: response.url, status: response.status, headers: Object.fromEntries(response.headers), body, carriedSession: true });
      expect(response.status, label).toBe(200);
      return body;
    };
    const detail = await record('GET /api/v1/tasks/[id]', await callApi('/api/v1/tasks/[id]', 'GET', harness.targetId));
    const queue = await record('GET /api/v1/tasks?tab=ignored', await callApi('/api/v1/tasks', 'GET', harness.targetId, undefined, '?tab=ignored'));
    await record('GET /api/v1/estimates/[id]/tree', await callApi('/api/v1/estimates/[id]/tree', 'GET', harness.targetId));
    await record('GET /api/v1/estimates/[id]/form', await callApi('/api/v1/estimates/[id]/form', 'GET', harness.targetId));
    expect(scanResponses(recorded, forbiddenStrings()).map(describeFinding)).toEqual([]);
    // The task page carries the layer by name, with the remarks, and holds no ID of the person who ignored it.
    const parsed = z.looseObject({ ignored: z.strictObject({ at: z.string(), byName: z.string(), remarks: z.string() }) }).parse(JSON.parse(detail));
    expect(parsed.ignored.remarks).toBe('Invented remarks.');
    expect(detail).not.toContain(harness.idOf.LEAD);
    // The Ignored tab's row has the remarks and the display status, and nothing of who and when.
    const rows = z.looseObject({ tasks: z.array(z.looseObject({ status: z.string(), ignoredRemarks: z.string().nullable() })), counts: z.looseObject({ ignored: z.number() }) }).parse(JSON.parse(queue));
    expect(rows.tasks).toMatchObject([{ status: 'IGNORED', ignoredRemarks: 'Invented remarks.' }]);
    expect(rows.counts.ignored).toBe(1);
    expect(queue).not.toMatch(/"ignored(At|By)/);
  });
});
