import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FORM_LOADING, sectionLinkText } from '@/components/features/estimate-workspace/estimate-texts';
import { SURFACE_HINT } from '@/components/features/estimate-workspace/surface-texts';

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
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getEstimateService: () => shared.estimateService, getEstimateReviewService: () => shared.estimateReviewService, getDownloadMarkerService: () => shared.downloadMarkerService, getCostDetailsService: () => shared.costDetailsService, getMastersService: () => shared.mastersService };
});

const { default: EstimatePage } = await import('@/app/(portal)/estimates/[code]/page');

const CODE = canaryTaskCodeFor(harness.targetId);
const estimate = () => defined(harness.estimateWorld.estimates[0]);
/**
 * The page's markup without the form's loading ghost (DEF-145, PF-6), which the page now draws on the server: **the form's own words** (the cards' names, their column ranges, the strip and the hints of the fields), drawn
 * inert and as grey blocks. The checks below are about the page, so the ghost is cut out of it; what the ghost may hold is held separately (the last test of this file). The ghost is cut by counting its `div`s.
 */
function splitGhost(html: string): { readonly ghost: string; readonly rest: string } {
  const marker = html.indexOf('data-part-ghost=""');
  const start = marker < 0 ? -1 : html.lastIndexOf('<div', marker);
  if (start < 0) return { ghost: '', rest: html };
  let depth = 0;
  for (const tag of html.slice(start).matchAll(/<(\/?)div\b[^>]*>/g)) {
    depth += tag[1] === '/' ? -1 : 1;
    if (depth === 0) {
      const end = start + (tag.index ?? 0) + tag[0].length;
      return { ghost: html.slice(start, end), rest: html.slice(0, start) + html.slice(end) };
    }
  }
  return { ghost: '', rest: html };
}
const withoutGhost = (html: string): string => splitGhost(html).rest;

const open = async (code: string): Promise<string> => renderToStaticMarkup(await EstimatePage({ params: Promise.resolve({ code }), searchParams: Promise.resolve({}) }));

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
    expect(html).toContain('Notes from Invented Lead');
    expect(html).toContain('Invented notes.');
  });

  it('AC-11: an estimate with no customer says so in one neutral sentence, keeps the tree and the form open (no inert area), and shows no notice to choose one', async () => {
    const html = await open(CODE);
    expect(html).toContain('No customer is set for this estimate. A Lead or an Admin can set one.');
    expect(html).not.toContain('Choose the customer to start.');
    expect(html).not.toContain('The form opens as soon as you pick one.');
    expect(withoutGhost(html)).not.toMatch(/inert=""/);
    expect(html).toContain('Parts and inputs');
  });

  it('AC-9: shows the Customer (with its short name) and the Subject as labelled text, in the one compact card (AQP-453), before and after a customer is set', async () => {
    const without = await open(CODE);
    for (const label of ['Customer', 'Subject', 'Task folder']) expect(without, label).toContain(label);
    expect(without).toContain('Only a Lead or Admin can change the customer.');
    expect(without).toContain('Invented subject');
    estimate().customerId = CUSTOMER_RECIPE_ID;
    const html = await open(CODE);
    expect(html).toContain('Canary-Customer-Alpha');
    const shortName = defined(harness.masters.customers.find((customer) => customer.id === CUSTOMER_RECIPE_ID)).shortName;
    expect(html).toContain(`(${shortName})`);
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
    expect(withoutGhost(html)).not.toMatch(/inert=""/);
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
    expect(withoutGhost(html)).not.toMatch(/\b(rates?|prices?|costs?|formulas?)\b/i);
    for (const review of ['Total Unit Production Price', 'File cell', 'How the total is built', 'Approve and lock', 'Not calculated']) expect(html).not.toContain(review);
  });

  describe('PF-6, NFR-002 (QLT-833-03): what the Engineer loading ghost may hold', () => {
    /**
     * The Engineer's page used to be scanned whole for the words rate, price, cost and formula, and for every word of the review. The ghost is cut out of that scan (its hints are the Engineer's own input guidance, and one
     * of them says "cost"), so it is held to something at least as strong: **every text of the ghost is, exactly, a text of the form definition this Engineer is sent by GET /form** (a card name and range, a strip item, a hint)
     * or one of the ghost's two fixed lines; **every attribute is on a short list** (class, a card's weight, the busy and inert state, the loading line's name, the ghost's own markers); and what is left of the ghost
     * once those are taken out holds no word of the scan and no figure (a digit, a decimal, a currency sign).
     */
    const decode = (text: string): string => text.replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
    const SCAN_WORDS = /\b(rates?|prices?|costs?|formulas?)\b/i;
    const FIGURE = /[$€₹]|\d[\d,]*[.,]\d|\d{3,}/;

    /** What is wrong with a ghost, in words: texts and attributes that are not the definition's, and any word or figure in what is left. */
    function ghostViolations(ghost: string, allowedTexts: ReadonlyArray<string>): string[] {
      const problems: string[] = [];
      const allowed = new Set(allowedTexts);
      const texts = [...ghost.matchAll(/>([^<>]+)</g)].map((match) => decode(match[1] ?? '').trim()).filter((text) => text !== '');
      for (const text of texts) if (!allowed.has(text)) problems.push(`text: ${text}`);
      const attributes = [...ghost.matchAll(/ ([a-zA-Z][\w:-]*)="([^"]*)"/g)];
      for (const [, name = '', value = ''] of attributes) {
        const known = name === 'class' || name === 'inert' || name === 'aria-hidden' || name === 'aria-busy' || name.startsWith('data-ghost') || name === 'data-part-ghost' || (name === 'role' && value === 'status') || (name === 'aria-label' && value === FORM_LOADING) || (name === 'style' && /^--n:\d+$/.test(value));
        if (!known) problems.push(`attribute: ${name}="${value}"`);
      }
      // What is left once the definition's own texts and the styling are taken out: no word of the scan, no figure.
      let rest = ghost.replace(/ (class|style)="[^"]*"/g, '');
      for (const text of [...allowed].sort((first, second) => second.length - first.length)) rest = rest.replaceAll(text, '').replaceAll(text.replaceAll('&', '&amp;').replaceAll("'", '&#x27;').replaceAll('"', '&quot;'), '');
      if (SCAN_WORDS.test(rest)) problems.push(`word of the scan in: ${rest.match(SCAN_WORDS)?.[0] ?? ''}`);
      if (FIGURE.test(rest.replace(/<[^>]*>/g, ' ')) || FIGURE.test(rest)) problems.push('a figure');
      return problems;
    }

    async function theGhostAndItsAllowedTexts(): Promise<{ readonly ghost: string; readonly allowed: ReadonlyArray<string> }> {
      harness.signInAs('ENGINEER');
      estimate().customerId = CUSTOMER_RECIPE_ID;
      const html = await open(CODE);
      const { ghost } = splitGhost(html);
      expect(ghost, 'the page draws the ghost').not.toBe('');
      const form = await harness.estimateService.getForm({ id: harness.idOf.ENGINEER, role: 'ENGINEER' }, estimate().id);
      const allowed = [
        'Loading the form',
        SURFACE_HINT,
        ...form.sections.flatMap((section) => [section.name, section.columnRange, sectionLinkText(section.number, section.shortName), ...section.fields.flatMap((field) => (field.hint === null ? [] : [field.hint]))]),
      ];
      return { ghost, allowed };
    }

    it('the real ghost holds only the form definition texts, attributes of the short list, and no figure', async () => {
      const { ghost, allowed } = await theGhostAndItsAllowedTexts();
      expect(ghostViolations(ghost, allowed)).toEqual([]);
      expect(allowed.length, 'the definition has texts to compare with').toBeGreaterThan(8);
    });

    /** The reviewer's three mutants (QLT-833-03) and every case the old whole-page scan caught: each must fail the new scan. */
    const MUTANTS: ReadonlyArray<{ readonly name: string; readonly change: (ghost: string) => string }> = [
      { name: 'a text "Machining rate 450.00 per hour"', change: (ghost) => ghost.replace('<div inert', '<span>Machining rate 450.00 per hour</span><div inert') },
      { name: 'a text "16889808.07"', change: (ghost) => ghost.replace('<div inert', '<span>16889808.07</span><div inert') },
      { name: 'an attribute title="Machining rate 450 per hour"', change: (ghost) => ghost.replace('<div inert', '<div title="Machining rate 450 per hour" inert') },
      { name: 'a text holding a section number, "1 rate"', change: (ghost) => ghost.replace('<div inert', '<span>1 rate</span><div inert') },
      { name: 'a word of the old scan, "cost"', change: (ghost) => ghost.replace('<div inert', '<span>cost</span><div inert') },
      { name: 'a word of the old scan in an attribute (aria-description="formula")', change: (ghost) => ghost.replace('<div inert', '<div aria-description="formula" inert') },
      { name: 'a word of the old scan, "price", in a data attribute', change: (ghost) => ghost.replace('<div inert', '<div data-price="12" inert') },
      { name: 'a word of the review, "Total Unit Production Price"', change: (ghost) => ghost.replace('<div inert', '<span>Total Unit Production Price</span><div inert') },
      { name: 'a word of the review, "File cell"', change: (ghost) => ghost.replace('<div inert', '<span>File cell</span><div inert') },
      { name: 'a currency sign in a text', change: (ghost) => ghost.replace('<div inert', '<span>₹ 5</span><div inert') },
      { name: 'a hint with a word added to it', change: (ghost) => ghost.replace('Enter 0 if there is none.', 'Enter 0 if there is none. rate') },
    ];
    for (const mutant of MUTANTS) {
      it(`fails when the ghost holds ${mutant.name}`, async () => {
        const { ghost, allowed } = await theGhostAndItsAllowedTexts();
        const changed = mutant.change(ghost);
        expect(changed, 'the mutant changed the ghost').not.toBe(ghost);
        expect(ghostViolations(changed, allowed), mutant.name).not.toEqual([]);
      });
    }
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

describe('DEF-141 (DL-455): the Lead\'s review hands the part form its data as props', () => {
  const props = async (code: string): Promise<Record<string, unknown>> => {
    const element = (await EstimatePage({ params: Promise.resolve({ code }), searchParams: Promise.resolve({}) })) as { props: Record<string, unknown> };
    return element.props;
  };

  it.each(['LEAD', 'ADMIN'] as const)('as %s the review gets a seed for the row it shows: the estimate, the part, and the four bodies the routes answer', async (role) => {
    harness.signInAs(role);
    const seed = (await props(CODE))['seed'] as Record<string, unknown> | undefined;
    expect(seed).toBeDefined();
    expect(Object.keys(defined(seed)).sort()).toEqual(['estimateId', 'form', 'materials', 'part', 'partId', 'treatments']);
    expect(seed?.['estimateId']).toBe(estimate().id);
    expect(seed?.['partId']).toBe(estimate().id);
    expect(Object.keys(seed?.['form'] as object).sort()).toEqual(['lastSavedAt', 'sections']);
  });

  it('the Engineer\'s page reads none of it: no seed, and no read of the option lists for the form', async () => {
    const materials = vi.spyOn(harness.mastersService, 'listMaterialOptions');
    const treatments = vi.spyOn(harness.mastersService, 'listTreatmentOptions');
    harness.signInAs('ENGINEER');
    const own = await props(CODE);
    expect(own['seed']).toBeUndefined();
    expect(materials).not.toHaveBeenCalled();
    expect(treatments).not.toHaveBeenCalled();
    materials.mockRestore();
    treatments.mockRestore();
  });

  it.each(['LEAD', 'ADMIN'] as const)('as %s the revision a save is sent with comes from the part answer the seed carries: no second read of the part (DEF-131 stage 2)', async (role) => {
    harness.signInAs(role);
    const node = vi.spyOn(harness.estimateService, 'getNode');
    const combined = vi.spyOn(harness.estimateService, 'getPartForm');
    const own = await props(CODE);
    expect(own['selectedRevision']).toBe(defined(harness.estimateWorld.nodes[0]).revision);
    expect(combined).toHaveBeenCalledTimes(1);
    expect(node).not.toHaveBeenCalled();
    node.mockRestore();
    combined.mockRestore();
  });

  it('with no seed (a read failed) the revision is read on its own, and a fault there is not turned into a revision of 0', async () => {
    harness.signInAs('LEAD');
    const broken = vi.spyOn(harness.estimateService, 'getPartForm').mockRejectedValue(new Error('invented fault'));
    const node = vi.spyOn(harness.estimateService, 'getNode');
    expect((await props(CODE))['selectedRevision']).toBe(defined(harness.estimateWorld.nodes[0]).revision);
    expect(node).toHaveBeenCalledTimes(1);
    node.mockRejectedValue(new Error('invented database fault'));
    await expect(props(CODE)).rejects.toThrow('invented database fault');
    broken.mockRestore();
    node.mockRestore();
  });

  it('a fault in a read gives the page no seed, so the form reads from the server as before, and the page still draws', async () => {
    harness.signInAs('LEAD');
    const broken = vi.spyOn(harness.estimateService, 'getPartForm').mockRejectedValue(new Error('invented fault'));
    expect((await props(CODE))['seed']).toBeUndefined();
    expect(await open(CODE)).toContain('id="review-calculate"');
    broken.mockRestore();
  });
});
