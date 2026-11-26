import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { defined } from '../support/defined';
import { canaryTaskCodeFor } from '../support/estimate-recipe';
import { FORBIDDEN_SIGNAL, harness, holdSessionClock, NOT_FOUND_SIGNAL, REDIRECT_PREFIX, releaseSessionClock } from '../support/session-harness';
import { storedRowOf } from '../support/stored-row';

/**
 * STORY-06.03 AC-1, AC-6, AC-7 and AC-8 (NFR-002) as pages: `/estimates/<code>/costs/<slNo>` as each role, through the real page guard, the real session and the real cost details service over in-memory
 * storage, drawn on the server the way the first paint is; and the Engineer's own page, which is the same with and without a stored row, with no link to the cost details. What a browser does with the
 * panels is `tests/e2e/cost-details.spec.ts`. Every name, ID and number is invented.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  // `useRouter` is the Recalculate button's: a Draft with current figures shows it since STORY-06.08 AC-11, and the page of a Draft is rendered here.
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound, usePathname: () => '/estimates/invented', useRouter: () => ({ refresh: () => undefined }) };
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
    getDownloadMarkerService: () => shared.downloadMarkerService,
    getCostDetailsService: () => shared.costDetailsService,
  };
});

const { default: CostDetailsPage } = await import('@/app/(portal)/estimates/[code]/costs/[slNo]/page');
const { default: EstimatePage } = await import('@/app/(portal)/estimates/[code]/page');

const CODE = canaryTaskCodeFor(harness.targetId);
const CALCULATION_ID = '00000000-0000-4000-8000-0000000ca1cb';
const estimate = () => defined(harness.estimateWorld.estimates[0]);
const part = () => defined(harness.estimateWorld.nodes[0]);
const openCosts = async (code: string, slNo: string): Promise<string> => renderToStaticMarkup(await CostDetailsPage({ params: Promise.resolve({ code, slNo }) }));
const openEstimate = async (code: string): Promise<string> => renderToStaticMarkup(await EstimatePage({ params: Promise.resolve({ code }) }));

/** A calculation of the harness estimate's one part holding the stored row of the invented oracle row, linked to the estimate at its revision of the moment. */
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
    rows: [{ id: '00000000-0000-4000-8000-0000000ca1d2', nodeId: part().id, parentId: null, sortIndex: 0, slNo: '1', inputs: stored.inputs, imageId: null, outputs: stored.outputs }],
  });
  estimate().currentCalculationId = CALCULATION_ID;
}

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  harness.signInAs('LEAD');
});

afterEach(() => {
  vi.restoreAllMocks();
  const held = estimate();
  held.inputsRevision = 0;
  held.currentCalculationId = null;
  harness.calculationWorld.calculations.length = 0;
});

describe('AC-1, AC-7: a Lead and an Admin open the row', () => {
  it.each(['LEAD', 'ADMIN'] as const)('as %s with a current calculation: the six panels, the formulas and the working of the row', async (role) => {
    plantCalculation();
    harness.signInAs(role);
    const html = await openCosts(CODE, '1');
    // The six stages; the parts tree column (AQP-452) is a seventh `details`, which has no `data-stage`.
    expect(html.match(/<details[^>]*data-stage/g)).toHaveLength(6);
    expect(html).toContain('AK = (M * I) - (O * Material-Scrap-Rate)');
    expect(html).toContain('AK = (0.3140 × 60) - (0.1140 × 25) = 15.99');
    expect(html).toContain('Calculated 05 Nov 2026, 10:42 IST · configuration version 1');
    expect(html).toContain(`href="/estimates/${CODE}"`);
  });

  it.each(['LEAD', 'ADMIN'] as const)('as %s with no calculation: the notice and no stage', async (role) => {
    harness.signInAs(role);
    const html = await openCosts(CODE, '1');
    expect(html).toContain('The Engineer has not calculated this estimate yet');
    expect(html).not.toMatch(/<details[^>]*data-stage/);
  });

  it('with a changed input the page says cleared and holds no stage and no figure of the calculation', async () => {
    plantCalculation();
    estimate().inputsRevision += 1;
    const html = await openCosts(CODE, '1');
    expect(html).toContain('Press Recalculate on the estimate to see the stages again.');
    expect(html).toContain('Go to the estimate to Recalculate');
    expect(html).not.toContain('once the estimate is calculated again');
    expect(html).not.toMatch(/<details[^>]*data-stage/);
    for (const absent of ['451.39', '15.99', 'Material-Scrap-Rate', '0.3140']) expect(html, absent).not.toContain(absent);
  });

  it('a part that is not in the estimate, an address that is no Sl. No and a code that is no task are the same SCR-26 "not found"', async () => {
    plantCalculation();
    for (const [code, slNo] of [[CODE, '2'], [CODE, '1.1'], [CODE, 'abc'], [CODE, '1/../2'], [CODE, ''], ['Q-1900-0001', '1']] as const) {
      await expect(openCosts(code, slNo), `${code} ${slNo}`).rejects.toThrow(NOT_FOUND_SIGNAL);
    }
  });

  it('a fault in the stored record is not turned into "not found": it is the error, which the framework answers with a fixed 500', async () => {
    plantCalculation();
    const record = defined(harness.calculationWorld.calculations[0]);
    const row = defined(record.rows[0]);
    harness.calculationWorld.calculations.splice(0, 1, { ...record, rows: [{ ...row, outputs: { ...row.outputs, [Object.keys(row.outputs)[0] ?? 'x']: '123456' } }] });
    await expect(openCosts(CODE, '1')).rejects.toThrow('The stored figures of a row cannot be reproduced from the calculation record.');
  });
});

describe('AC-8 (NFR-002): the Engineer and nobody signed in get nothing', () => {
  it('an Engineer is "no access" before anything is read, for a real address and an invented one, and no read is made', async () => {
    plantCalculation();
    harness.signInAs('ENGINEER');
    const spies = [vi.spyOn(harness.reviewReads, 'findFigureBasis'), vi.spyOn(harness.reviewReads, 'findRowWorking'), vi.spyOn(harness.reviewReads, 'listNodes')];
    const workspace = vi.spyOn(harness.estimateService, 'getWorkspace');
    for (const [code, slNo] of [[CODE, '1'], ['Q-1900-0001', '9'], [CODE, 'abc']] as const) await expect(openCosts(code, slNo)).rejects.toThrow(FORBIDDEN_SIGNAL);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(workspace).not.toHaveBeenCalled();
  });

  it('nobody signed in is sent to sign in before anything is read', async () => {
    harness.signInAs(null);
    const workspace = vi.spyOn(harness.estimateService, 'getWorkspace');
    await expect(openCosts(CODE, '1')).rejects.toThrow(`${REDIRECT_PREFIX}/sign-in`);
    expect(workspace).not.toHaveBeenCalled();
  });

  it('the Engineer\'s own page is the same with a stored row as without, and holds no link to the cost details, no formula and no working', async () => {
    harness.signInAs('ENGINEER');
    const before = await openEstimate(CODE);
    plantCalculation();
    const after = await openEstimate(CODE);
    expect(after).toBe(before);
    for (const absent of ['View cost details', '/costs/', 'Cost details', 'Material-Scrap-Rate', '(M * I)', '15.99', '451.39']) expect(after, absent).not.toContain(absent);
  });

  it('the Lead\'s review of the same estimate links to the row\'s cost details, by the task code and the Sl. No', async () => {
    plantCalculation();
    harness.signInAs('LEAD');
    const html = await openEstimate(CODE);
    expect(html).toContain(`href="/estimates/${CODE}/costs/1"`);
    expect(html).toContain('View cost details');
  });
});
