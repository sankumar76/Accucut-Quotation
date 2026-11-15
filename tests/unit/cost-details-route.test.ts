import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { nodeCostsSchema } from '@/server/views/schemas/node-costs';

import { forbiddenStrings } from '../support/canary-masters';
import { defined } from '../support/defined';
import { fixedForbiddenProblem, scanResponse } from '../support/scanner';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';
import { storedRowOf } from '../support/stored-row';

/**
 * STORY-06.03 AC-1, AC-7 and AC-8 (NFR-002; architecture section 6 "Cost details"), through the real `withRoute`, the real session and the real cost details service over in-memory storage:
 * `GET /estimates/{id}/nodes/{nodeId}/costs` answers a Lead and an Admin with the state and, only while it is `current`, the six stages of that row; an Engineer gets the fixed 403 before either ID
 * is looked at, and nobody signed in gets 401; a part of another estimate is the same 404 as a part that does not exist. Who may call on every route is `tests/security/role-matrix.test.ts`.
 * Every name, ID and number is invented.
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
    getEstimateService: () => shared.estimateService,
    getEstimateReviewService: () => shared.estimateReviewService,
    getCostDetailsService: () => shared.costDetailsService,
  };
});

const route = await import('@/app/api/v1/estimates/[id]/nodes/[nodeId]/costs/route');
const ORIGIN = 'https://portal.example.test';
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';
const CALCULATION_ID = '00000000-0000-4000-8000-0000000ca1ca';
const OTHER_ESTIMATE_ID = '00000000-0000-4000-8000-0000000e5799';
const OTHER_NODE_ID = '00000000-0000-4000-8000-000000000099';

const record = z.record(z.string(), z.unknown());
const estimate = () => defined(harness.estimateWorld.estimates[0]);
const part = () => defined(harness.estimateWorld.nodes[0]);
const request = (): Request => new Request(`${ORIGIN}/api/v1/estimates/x/nodes/y/costs`);
const get = (id: string, nodeId: string) => route.GET(request(), { params: Promise.resolve({ id, nodeId }) });
const bodyOf = async (response: Response): Promise<Record<string, unknown>> => record.parse(await response.json());

/** A calculation of the harness estimate's one part, linked to it, made at the estimate's revision of the moment, holding the stored row of the invented oracle row. */
function plantCalculation(): void {
  const stored = storedRowOf();
  harness.calculationWorld.calculations.push({
    id: CALCULATION_ID,
    estimateId: estimate().id,
    configVersionId: '00000000-0000-4000-8000-0aaa00000001',
    inputsRevision: estimate().inputsRevision,
    masterSnapshot: stored.snapshot,
    productValues: { totalPrice: '451.398096', pricePerToolCost: null, toolCostTotal: '0' },
    createdById: harness.idOf.ENGINEER,
    warnings: [],
    createdAt: new Date('2026-11-05T05:12:00.000Z'),
    rows: [{ id: '00000000-0000-4000-8000-0000000ca1d1', nodeId: part().id, parentId: null, sortIndex: 0, slNo: '1', inputs: stored.inputs, imageId: null, outputs: stored.outputs }],
  });
  estimate().currentCalculationId = CALCULATION_ID;
}

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('LEAD');
});

afterEach(() => {
  vi.restoreAllMocks();
  const held = estimate();
  held.inputsRevision = 0;
  held.currentCalculationId = null;
  harness.calculationWorld.calculations.length = 0;
  const strangers = harness.estimateWorld.nodes.filter((node) => node.id === OTHER_NODE_ID);
  for (const stranger of strangers) harness.estimateWorld.nodes.splice(harness.estimateWorld.nodes.indexOf(stranger), 1);
});

describe('AC-1, AC-7: a Lead and an Admin are answered with the state and, while current, the six stages of the row', () => {
  it.each(['LEAD', 'ADMIN'] as const)('as %s with no calculation: 200, `none`, the row and no stage, `no-store`, a request ID, and the answer passes the strict schema', async (role) => {
    harness.signInAs(role);
    const response = await get(estimate().id, part().id);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Request-Id')).toMatch(/^req-[0-9a-f]{8}$/);
    expect(nodeCostsSchema.parse(await response.json())).toEqual({ state: 'none', row: { nodeId: part().id, slNo: '1', name: '' }, details: null });
  });

  it.each(['LEAD', 'ADMIN'] as const)('as %s with a current calculation: the six stages, the AK line worked from the stored operands, and the version and time of the calculation', async (role) => {
    plantCalculation();
    harness.signInAs(role);
    const body = nodeCostsSchema.parse(await (await get(estimate().id, part().id)).json());
    expect(body.state).toBe('current');
    expect(body.details).toMatchObject({ calculatedAt: '2026-11-05T05:12:00.000Z', configurationNumber: 1, letters: { count: 'H', unitPrice: 'BG' }, notApplicable: false });
    expect(body.details?.stages).toHaveLength(6);
    const ak = defined(body.details?.stages[1]?.lines.find((line) => line.letter === 'AK'));
    expect(ak).toMatchObject({ working: '(0.3140 × 60) - (0.1140 × 25)', value: '15.99' });
  });

  it('holds no customer name, no master record and no rate that no formula of the row uses', async () => {
    plantCalculation();
    const text = await (await get(estimate().id, part().id)).text();
    for (const absent of ['Invented Customer', 'Plating-rate-per-sqin', 'masterSnapshot', 'materialConsidered']) expect(text, absent).not.toContain(absent);
  });

  it('once an input has changed the state is `out-of-date` and nothing of the calculation is in the answer, in any form', async () => {
    plantCalculation();
    estimate().inputsRevision += 1;
    const response = await get(estimate().id, part().id);
    const text = await response.clone().text();
    expect(nodeCostsSchema.parse(await response.json())).toMatchObject({ state: 'out-of-date', details: null });
    for (const leaked of ['451.39', '15.99', '0.3140', 'Material-Scrap-Rate', 'Cutting-Rate-per-Sec', '(M * I)', '12%', 'stages']) expect(text, leaked).not.toContain(leaked);
  });

  it('an estimate that does not exist, an ID that is no UUID, a part that does not exist and a part of another estimate are all the same 404', async () => {
    harness.estimateWorld.nodes.push({ id: OTHER_NODE_ID, estimateId: OTHER_ESTIMATE_ID, parentId: null, sortIndex: 0, revision: 1, inputs: {} });
    const answers = await Promise.all(
      [
        [UNKNOWN_ID, part().id],
        ['not-an-id', part().id],
        [estimate().id, UNKNOWN_ID],
        [estimate().id, 'not-an-id'],
        [estimate().id, OTHER_NODE_ID],
      ].map(async ([id, nodeId]) => {
        const response = await get(defined(id), defined(nodeId));
        const { requestId, ...fixed } = await bodyOf(response);
        expect(requestId).toMatch(/^req-[0-9a-f]{8}$/);
        return { status: response.status, fixed };
      }),
    );
    for (const answer of answers) expect(answer.status).toBe(404);
    expect(new Set(answers.map((answer) => JSON.stringify(answer.fixed))).size).toBe(1);
  });

  it('is a read: the route exports GET and no other method', () => {
    expect(Object.keys(route).filter((name) => /^(GET|HEAD|POST|PUT|PATCH|DELETE)$/.test(name))).toEqual(['GET']);
  });
});

describe('AC-8 (NFR-002): an Engineer and a signed-out caller get nothing', () => {
  const FORBIDDEN = forbiddenStrings();

  it('an Engineer is refused 403 with the fixed body, before either ID is looked at, and nothing of a calculated estimate is in it', async () => {
    plantCalculation();
    harness.signInAs('ENGINEER');
    const spies = [vi.spyOn(harness.reviewReads, 'findFigureBasis'), vi.spyOn(harness.reviewReads, 'findRowWorking'), vi.spyOn(harness.reviewReads, 'listNodes')];
    for (const [id, nodeId] of [
      [estimate().id, part().id],
      [UNKNOWN_ID, UNKNOWN_ID],
      [estimate().id, OTHER_NODE_ID],
    ] as const) {
      const response = await get(id, nodeId);
      const recorded = { label: 'GET node costs', url: ORIGIN, status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
      expect(fixedForbiddenProblem(recorded)).toBeNull();
      expect(scanResponse(recorded, FORBIDDEN)).toEqual([]);
      for (const leaked of ['451.39', '15.99', 'Material-Scrap-Rate', '(M * I)', 'state', 'stages', 'details', 'working', 'formula']) expect(recorded.body, leaked).not.toContain(leaked);
    }
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('nobody signed in is 401, and nothing is read', async () => {
    harness.signInAs(null);
    const spy = vi.spyOn(harness.reviewReads, 'findFigureBasis');
    expect((await get(estimate().id, part().id)).status).toBe(401);
    expect(spy).not.toHaveBeenCalled();
  });

  it('the service refuses an Engineer by itself, so a caller that skipped the route still reads nothing', async () => {
    const spies = [vi.spyOn(harness.reviewReads, 'findFigureBasis'), vi.spyOn(harness.reviewReads, 'findRowWorking'), vi.spyOn(harness.reviewReads, 'listNodes')];
    await expect(harness.costDetailsService.getNodeCosts({ id: harness.idOf.ENGINEER, role: 'ENGINEER' }, estimate().id, part().id)).rejects.toMatchObject({ httpStatus: 403, code: 'FORBIDDEN' });
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
