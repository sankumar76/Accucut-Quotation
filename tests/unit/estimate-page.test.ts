import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { CUSTOMER_RECIPE_ID } from '../support/customer-canary';
import { defined } from '../support/defined';
import { canaryTaskCodeFor } from '../support/estimate-recipe';
import { harness, holdSessionClock, NOT_FOUND_SIGNAL, REDIRECT_PREFIX, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-05.01 T6 (AC-1, AC-5, AC-6), changed by CR-01 item 6 (AQP-390, AC-9 to AC-12): `/estimates/<code>` as each role, through the real page guard, the real session and the real estimate service
 * over in-memory storage, drawn on the server the way the first paint is. The Engineer sees the customer, its short name and the subject as read-only text and has no picker, no notice and no
 * change action; a Lead and an Admin see the Change customer action on an estimate that is not approved. What a browser does with the dialog is the E2E spec's. Every name, path and date is invented.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  // `usePathname`: the parts tree's drawer button is a first-open control (`useFirstOpen`, AQP-339), which reads the path to clear its failure line when the page changes.
  // `useRouter`: the Lead's Calculate or Recalculate button (STORY-06.04) reads the router to draw the page again after a press; a static render never calls it.
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound, usePathname: () => '/estimates/invented', useRouter: () => ({ refresh: () => undefined }) };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getEstimateService: () => shared.estimateService, getEstimateReviewService: () => shared.estimateReviewService, getDownloadMarkerService: () => shared.downloadMarkerService, getCostDetailsService: () => shared.costDetailsService };
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

  it('AC-11: an estimate with no customer says so in one neutral sentence, keeps the tree and the form open (no inert area), and shows no notice to choose one', async () => {
    const html = await open(CODE);
    expect(html).toContain('No customer is set for this estimate. A Lead or an Admin can set one.');
    expect(html).not.toContain('Choose the customer to start.');
    expect(html).not.toContain('The form opens as soon as you pick one.');
    expect(html).not.toMatch(/inert=""/);
    expect(html).toContain('Parts and inputs');
  });

  it('AC-9: shows Customer Name, Customer Short Name and Subject (project name) as labelled text, before and after a customer is set', async () => {
    const without = await open(CODE);
    for (const label of ['Customer Name', 'Customer Short Name', 'Subject (project name)']) expect(without, label).toContain(label);
    expect(without).toContain('Invented subject');
    estimate().customerId = CUSTOMER_RECIPE_ID;
    const html = await open(CODE);
    expect(html).toContain('Canary-Customer-Alpha');
    const shortName = defined(harness.masters.customers.find((customer) => customer.id === CUSTOMER_RECIPE_ID)).shortName;
    expect(html).toContain(`>${shortName}<`);
  });

  it('AC-10: there is no customer picker, no "Choose this first", no hint about changing it, no list to load and no control to change the customer, in any state', async () => {
    for (const customerId of [null, CUSTOMER_RECIPE_ID]) {
      estimate().customerId = customerId;
      const html = await open(CODE);
      for (const gone of ['Choose this first', 'Changing it later asks you to confirm.', 'Loading customers', 'estimate-customer', 'Choose the customer to start.', 'Customer saved.']) {
        expect(html, gone).not.toContain(gone);
      }
      expect(html).not.toContain('<select');
      expect(html).not.toContain('Change customer');
      expect(html).not.toContain('Set customer');
      expect(html).not.toContain('review-change-customer');
    }
  });

  it('with a customer set the area is open and the customer is named', async () => {
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

  it('a prepared estimate is shown read-only: its status, the customer it has, and no control to change it', async () => {
    estimate().status = 'PREPARED';
    estimate().customerId = CUSTOMER_RECIPE_ID;
    const html = await open(CODE);
    expect(html).toContain('Prepared');
    // The customer field and its locked hint are gone with the picker: the status and the customer are read-only text.
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

  it('a Lead and an Admin may open any task, and see the review (STORY-06.02): the header, the customer as text with the Change customer action and the tiles, with no customer form on the page', async () => {
    for (const role of ['LEAD', 'ADMIN'] as const) {
      harness.signInAs(role);
      const html = await open(CODE);
      expect(html).toContain(CODE);
      expect(html).toContain('Not set');
      expect(html).toContain('Set customer');
      expect(html).toContain('Total Unit Production Price');
      expect(html).not.toContain('Choose the customer to start.');
      expect(html).not.toContain('<select');
      expect(html).not.toContain('Parts and inputs');
    }
  });

  it('the Lead sees the customer by name and short name, with "Change customer" while the estimate is a draft or prepared, and none once it is approved (AC-12)', async () => {
    estimate().customerId = CUSTOMER_RECIPE_ID;
    harness.signInAs('LEAD');
    for (const status of ['DRAFT', 'PREPARED'] as const) {
      estimate().status = status;
      const html = await open(CODE);
      expect(html).toContain('Canary-Customer-Alpha');
      expect(html).toContain('id="review-change-customer"');
      expect(html).toContain('Change customer');
    }
    estimate().status = 'APPROVED';
    const approved = await open(CODE);
    expect(approved).toContain('Canary-Customer-Alpha');
    expect(approved).not.toContain('review-change-customer');
  });

  it('an Engineer\'s page never carries the dialog\'s words or the action, whatever the state', async () => {
    estimate().customerId = CUSTOMER_RECIPE_ID;
    harness.signInAs('ENGINEER');
    for (const status of ['DRAFT', 'PREPARED', 'APPROVED'] as const) {
      estimate().status = status;
      const html = await open(CODE);
      for (const word of ['Change the customer?', 'New customer', 'Change customer', 'review-change-customer']) expect(html, word).not.toContain(word);
    }
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

describe('STORY-CR01.7E QLT-03, AC-6: the download marker in the Lead\'s header', () => {
  it('shows "Not downloaded" for a Lead and an Admin, and nothing of it on the Engineer\'s page', async () => {
    harness.signInAs('LEAD');
    expect(await open(CODE)).toContain('Not downloaded');
    harness.signInAs('ADMIN');
    expect(await open(CODE)).toContain('Not downloaded');
    harness.signInAs('ENGINEER');
    const engineers = await open(CODE);
    expect(engineers).not.toMatch(/Not downloaded|Downloaded \d+×|Changed since download|Download status/);
  });

  it('a fault in the marker read does not take the review down: the header says "Download status unavailable.", never "Not downloaded", and only the kind of the fault is logged', async () => {
    const { logger } = await import('@/lib/logger');
    harness.signInAs('LEAD');
    vi.spyOn(harness.downloadMarkerService, 'getMarker').mockRejectedValueOnce(new TypeError('connect ECONNREFUSED db.invented-host.test:5432'));
    const html = await open(CODE);
    expect(html).toContain('Download status unavailable.');
    expect(html).not.toContain('Not downloaded');
    // The review itself is still there.
    expect(html).toContain(CODE);
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith({ errorName: 'TypeError', errorCode: undefined }, 'The download marker could not be read.');
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain('invented-host');
    vi.restoreAllMocks();
  });
});
