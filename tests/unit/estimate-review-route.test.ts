import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { costsSchema } from '@/server/views/schemas/costs';

import { defined } from '../support/defined';
import { REVIEW_FIELDS } from '../support/review-world';
import { fixedForbiddenProblem, scanResponse } from '../support/scanner';
import { forbiddenStrings } from '../support/canary-masters';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-06.02 AC-4 and AC-5 (NFR-002; architecture section 6 "Cost"), through the real `withRoute`, the real session and the real review service over in-memory storage: `GET /estimates/{id}/costs`
 * answers a Lead and an Admin with the state and, only while it is `current`, the figures; an Engineer gets the fixed 403 before anything is looked at, and nobody signed in gets 401. Who may call on
 * every route is `tests/security/role-matrix.test.ts`. Every name, ID and number is invented.
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
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getEstimateService: () => shared.estimateService, getEstimateReviewService: () => shared.estimateReviewService };
});

const route = await import('@/app/api/v1/estimates/[id]/costs/route');
const ORIGIN = 'https://portal.example.test';
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';
const CALCULATION_ID = '00000000-0000-4000-8000-0000000ca1c9';
const BL = '1234567.891';

const record = z.record(z.string(), z.unknown());
const estimate = () => defined(harness.estimateWorld.estimates[0]);
const part = () => defined(harness.estimateWorld.nodes[0]);
const request = (): Request => new Request(`${ORIGIN}/api/v1/estimates/x/costs`);
const get = (id: string) => route.GET(request(), { params: Promise.resolve({ id }) });
const bodyOf = async (response: Response): Promise<Record<string, unknown>> => record.parse(await response.json());

/** A calculation of the harness estimate's one part, linked to it, made at the estimate's revision of the moment. */
function plantCalculation(): void {
  harness.calculationWorld.calculations.push({
    id: CALCULATION_ID,
    estimateId: estimate().id,
    configVersionId: '00000000-0000-4000-8000-0aaa00000001',
    inputsRevision: estimate().inputsRevision,
    masterSnapshot: { customer: { id: 'c', name: 'Invented customer' }, rates: [], materials: [], exchangeRates: { usd: null, eur: null } },
    productValues: { totalPrice: BL, pricePerToolCost: null, toolCostTotal: '0' },
    createdById: harness.idOf.ENGINEER,
    warnings: [],
    createdAt: new Date('2026-11-05T05:12:00.000Z'),
    rows: [
      {
        id: '00000000-0000-4000-8000-0000000ca1d0',
        nodeId: part().id,
        parentId: null,
        sortIndex: 0,
        slNo: '1',
        inputs: {},
        imageId: null,
        outputs: { [REVIEW_FIELDS.bg]: BL, [REVIEW_FIELDS.bj]: '15433.0986375', [REVIEW_FIELDS.bk]: '13717.4210111' },
      },
    ],
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
});

describe('AC-4: a Lead and an Admin are answered with the state and, while current, the figures', () => {
  it.each(['LEAD', 'ADMIN'] as const)('as %s with no calculation: 200, `none`, no figure, `no-store`, a request ID, and the answer passes the strict schema', async (role) => {
    harness.signInAs(role);
    const response = await get(estimate().id);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Request-Id')).toMatch(/^req-[0-9a-f]{8}$/);
    const body = costsSchema.parse(await response.json());
    expect(body).toMatchObject({ state: 'none', calculatedAt: null, configurationNumber: null, totals: null });
    expect(body.nodes.map((node) => node.figures)).toEqual([null]);
  });

  it.each(['LEAD', 'ADMIN'] as const)('as %s with a current calculation: the state, the time, the version, the row\'s own figures and BL', async (role) => {
    plantCalculation();
    harness.signInAs(role);
    const body = costsSchema.parse(await (await get(estimate().id)).json());
    expect(body).toMatchObject({ state: 'current', calculatedAt: '2026-11-05T05:12:00.000Z', configurationNumber: 1, totals: { totalPrice: BL, pricePerToolCost: null, toolCostTotal: '0' } });
    expect(body.nodes[0]?.figures).toEqual({ unitPrice: BL, unitPriceUsd: '15433.0986375', unitPriceEur: '13717.4210111' });
  });

  it('once an input has changed the state is `out-of-date` and not one figure of the calculation is in the answer, in any form', async () => {
    plantCalculation();
    estimate().inputsRevision += 1;
    const response = await get(estimate().id);
    const text = await response.clone().text();
    expect(costsSchema.parse(await response.json())).toMatchObject({ state: 'out-of-date', totals: null });
    for (const figure of [BL, '1234567.89', '12,34,567.89', '1,234,567.89', '15433.0986375', '13717.4210111']) expect(text).not.toContain(figure);
  });

  it('an estimate that does not exist, and an ID that is no UUID, are the same 404', async () => {
    for (const id of [UNKNOWN_ID, 'not-an-id']) {
      const response = await get(id);
      expect(response.status).toBe(404);
      expect(await bodyOf(response)).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    }
  });

  it('is a read: the route exports GET and no other method', () => {
    expect(Object.keys(route).filter((name) => /^(GET|HEAD|POST|PUT|PATCH|DELETE)$/.test(name))).toEqual(['GET']);
  });
});

describe('AC-5 (NFR-002): an Engineer and a signed-out caller get nothing', () => {
  const FORBIDDEN = forbiddenStrings();

  it('an Engineer is refused 403 with the fixed body, before the estimate is looked at, and no figure of a calculated estimate is in it', async () => {
    plantCalculation();
    harness.signInAs('ENGINEER');
    const spies = [vi.spyOn(harness.reviewReads, 'findFigureBasis'), vi.spyOn(harness.reviewReads, 'findReviewFigures'), vi.spyOn(harness.reviewReads, 'listNodes')];
    for (const id of [estimate().id, UNKNOWN_ID]) {
      const response = await get(id);
      const recorded = { label: 'GET costs', url: ORIGIN, status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
      expect(fixedForbiddenProblem(recorded)).toBeNull();
      expect(scanResponse(recorded, FORBIDDEN)).toEqual([]);
      expect(recorded.body).not.toContain(BL);
      expect(recorded.body).not.toMatch(/state|totals|figures|nodes/);
    }
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('nobody signed in is 401, and nothing is read', async () => {
    harness.signInAs(null);
    const spy = vi.spyOn(harness.reviewReads, 'findFigureBasis');
    expect((await get(estimate().id)).status).toBe(401);
    expect(spy).not.toHaveBeenCalled();
  });

  it('the service refuses an Engineer by itself, so a caller that skipped the route still reads nothing', async () => {
    const spy = vi.spyOn(harness.reviewReads, 'findFigureBasis');
    await expect(harness.estimateReviewService.getCosts({ id: harness.idOf.ENGINEER, role: 'ENGINEER' }, estimate().id)).rejects.toMatchObject({ httpStatus: 403, code: 'FORBIDDEN' });
    expect(spy).not.toHaveBeenCalled();
  });
});
