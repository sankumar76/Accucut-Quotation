import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { CUSTOMER_RECIPE_ID } from '../support/customer-canary';
import { defined } from '../support/defined';
import { canaryTaskCodeFor } from '../support/estimate-recipe';
import { harness, holdSessionClock, NOT_FOUND_SIGNAL, REDIRECT_PREFIX, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-05.01 T6 (AC-1, AC-4 as drawn, AC-5, AC-6): `/estimates/<code>` as each role, through the real page guard, the real session and the real estimate service
 * over in-memory storage, drawn on the server the way the first paint is. What a browser does with the customer field (the list, the choice, the dialog) is the
 * E2E spec's. Every name, path and date is invented.
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

const { default: EstimatePage } = await import('@/app/(portal)/estimates/[code]/page');

const CODE = canaryTaskCodeFor(harness.targetId);
const estimate = () => defined(harness.estimateWorld.estimates[0]);
const open = async (code: string): Promise<string> => renderToStaticMarkup(await EstimatePage({ params: Promise.resolve({ code }) }));

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  harness.signInAs('ENGINEER');
});

afterEach(() => {
  const held = estimate();
  held.status = 'DRAFT';
  held.customerId = null;
  held.engineerId = harness.idOf.ENGINEER;
  held.notes = 'Invented notes.';
  held.inputsRevision = 0;
  held.currentCalculationId = null;
  harness.calculationWorld.calculations.length = 0;
});

describe('AC-1: the Engineer opens their task with no customer', () => {
  it('shows the code, the status, the deadline in IST, the folder as a link with Copy path, the notes and who wrote them', async () => {
    const html = await open(CODE);
    expect(html).toContain(CODE);
    expect(html).toContain('Draft');
    expect(html).toContain('Due 01 Jan 2099, 10:00 IST');
    expect(html).toContain('\\\\invented-server\\invented-share\\RFQ-canary');
    expect(html).toContain('href="file:////invented-server/invented-share/RFQ-canary"');
    expect(html).toContain('Copy path');
    expect(html).toContain('Notes from Invented Lead: ');
    expect(html).toContain('Invented notes.');
  });

  it('shows the notice "Choose the customer to start." and disables the tree and form area until a customer is chosen', async () => {
    const html = await open(CODE);
    expect(html).toContain('Choose the customer to start.');
    expect(html).toContain('The form opens as soon as you pick one.');
    expect(html).toMatch(/<div[^>]*aria-disabled="true"[^>]*inert=""[^>]*>|<div[^>]*inert=""[^>]*aria-disabled="true"[^>]*>/);
  });

  it('draws the Customer field with "Choose this first" and the hint that changing it later asks to confirm, with the list still to come from the server', async () => {
    const html = await open(CODE);
    expect(html).toContain('Customer');
    expect(html).toContain('Choose this first');
    expect(html).toContain('Changing it later asks you to confirm.');
    expect(html).toContain('Loading customers');
    expect(html).not.toContain('Canary-Customer-Alpha');
  });

  it('with a customer already chosen the notice is gone, the area is open and the field is for the list to fill', async () => {
    estimate().customerId = CUSTOMER_RECIPE_ID;
    const html = await open(CODE);
    expect(html).not.toContain('Choose the customer to start.');
    expect(html).not.toMatch(/inert=""/);
    expect(html).toContain('Canary-Customer-Alpha');
  });

  it('a task with no notes shows no notes line', async () => {
    estimate().notes = null;
    expect(await open(CODE)).not.toContain('Notes from');
  });

  it('a submitted estimate is shown read-only: its status, the customer it has, and no list to choose from', async () => {
    estimate().status = 'SUBMITTED';
    estimate().customerId = CUSTOMER_RECIPE_ID;
    const html = await open(CODE);
    expect(html).toContain('Submitted');
    expect(html).toContain('This estimate can no longer be changed.');
    expect(html).toContain('Canary-Customer-Alpha');
    expect(html).not.toContain('Choose the customer to start.');
  });
});

describe('AC-5: who may open it', () => {
  it('another Engineer, and a code that does not exist, are the same SCR-26 "not found"', async () => {
    estimate().engineerId = harness.targetId;
    await expect(open(CODE)).rejects.toThrow(NOT_FOUND_SIGNAL);
    harness.signInAs('ENGINEER');
    estimate().engineerId = harness.idOf.ENGINEER;
    await expect(open('Q-2026-9999')).rejects.toThrow(NOT_FOUND_SIGNAL);
  });

  it('a Lead and an Admin may open any task, and see the review (STORY-06.02): the header, the customer as text and the tiles, with no customer form', async () => {
    for (const role of ['LEAD', 'ADMIN'] as const) {
      harness.signInAs(role);
      const html = await open(CODE);
      expect(html).toContain(CODE);
      expect(html).toContain('Not chosen yet');
      expect(html).toContain('Total Unit Production Price');
      expect(html).not.toContain('Choose the customer to start.');
      expect(html).not.toContain('<select');
      expect(html).not.toContain('Parts and inputs');
    }
  });

  it('the Lead sees the customer chosen, by name', async () => {
    estimate().customerId = CUSTOMER_RECIPE_ID;
    harness.signInAs('LEAD');
    expect(await open(CODE)).toContain('Canary-Customer-Alpha');
  });

  it('an unknown code is "not found" for a Lead too', async () => {
    harness.signInAs('LEAD');
    await expect(open('Q-2026-9999')).rejects.toThrow(NOT_FOUND_SIGNAL);
  });

  it('signed out is sent to sign in before anything is read', async () => {
    harness.signInAs(null);
    await expect(open(CODE)).rejects.toThrow(`${REDIRECT_PREFIX}/sign-in`);
  });
});

describe('AC-6 (NFR-002): no rate, cost or formula on the Engineer\'s page', () => {
  it('as ENGINEER the page names none of a rate, a price, a cost or a formula, and none of the words of the review', async () => {
    harness.signInAs('ENGINEER');
    estimate().customerId = CUSTOMER_RECIPE_ID;
    const html = await open(CODE);
    expect(html).not.toMatch(/\b(rates?|prices?|costs?|formulas?)\b/i);
    for (const review of ['Total Unit Production Price', 'File cell', 'How the total is built', 'Approve and lock', 'Not calculated']) expect(html).not.toContain(review);
  });

  it('the Engineer\'s page is the same whether or not a calculation exists (STORY-06.02 AC-5)', async () => {
    harness.signInAs('ENGINEER');
    const before = await open(CODE);
    harness.calculationWorld.calculations.push({
      id: '00000000-0000-4000-8000-0000000ca1c8',
      estimateId: estimate().id,
      configVersionId: '00000000-0000-4000-8000-0aaa00000001',
      inputsRevision: 0,
      masterSnapshot: { customer: { id: 'c', name: 'Invented customer' }, rates: [], materials: [], exchangeRates: { usd: null, eur: null } },
      productValues: { totalPrice: '1234567.891', pricePerToolCost: null, toolCostTotal: '0' },
      createdById: harness.idOf.ENGINEER,
      warnings: [],
      createdAt: new Date('2026-11-05T05:12:00.000Z'),
      rows: [],
    });
    estimate().currentCalculationId = '00000000-0000-4000-8000-0000000ca1c8';
    const after = await open(CODE);
    expect(after).toBe(before);
    expect(after).not.toContain('1234567');
  });
});

describe('STORY-06.02: the Lead\'s and the Admin\'s review of the estimate', () => {
  it.each(['LEAD', 'ADMIN'] as const)('as %s with no calculation: "Not calculated", the notice, dashes, Calculate off, and no figure', async (role) => {
    harness.signInAs(role);
    const html = await open(CODE);
    expect(html).toContain('The Engineer has not calculated this estimate yet.');
    expect(html).toContain('Not calculated');
    expect(html).toContain('id="review-calculate"');
    expect(html).not.toContain('How the total is built');
  });

  it('with a current calculation the Lead sees BL in rupees and the row\'s own figure, and with a changed input the figures are gone and the page says cleared', async () => {
    harness.signInAs('LEAD');
    harness.calculationWorld.calculations.push({
      id: '00000000-0000-4000-8000-0000000ca1c7',
      estimateId: estimate().id,
      configVersionId: '00000000-0000-4000-8000-0aaa00000001',
      inputsRevision: 0,
      masterSnapshot: { customer: { id: 'c', name: 'Invented customer' }, rates: [], materials: [], exchangeRates: { usd: null, eur: null } },
      productValues: { totalPrice: '1234567.891', pricePerToolCost: null, toolCostTotal: '0' },
      createdById: harness.idOf.ENGINEER,
      warnings: [],
      createdAt: new Date('2026-11-05T05:12:00.000Z'),
      rows: [],
    });
    estimate().currentCalculationId = '00000000-0000-4000-8000-0000000ca1c7';
    const current = await open(CODE);
    expect(current).toContain('₹ 12,34,567.89');
    expect(current).toContain('Calculated 05 Nov 2026, 10:42 IST · configuration version 1');
    estimate().inputsRevision = 1;
    const cleared = await open(CODE);
    expect(cleared).toContain('The total is cleared because an input changed.');
    expect(cleared).not.toContain('12,34,567');
  });
});
