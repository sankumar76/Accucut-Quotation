import { readFileSync } from 'node:fs';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FORM_LOADING, FORM_LOCKED, sectionLinkText } from '@/components/features/estimate-workspace/estimate-texts';
import { SURFACE_HINT } from '@/components/features/estimate-workspace/surface-texts';
import * as layout from '@/components/shared/form-layout';
import { Notice } from '@/components/shared/notice';
import { inputsNotice } from '@/components/features/estimate-review/review-texts';
import { SURFACE_LABEL, SURFACE_NONE_SELECTED } from '@/components/features/estimate-workspace/surface-texts';
import { QTY_PER_ASSY_HINT } from '@/lib/estimate/quantity-hint';
import { parseForm, parsePartInputs } from '@/lib/estimates/form-client';
import { sectionProgress, shownSections } from '@/lib/estimates/form-shown';

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

  describe('PF-6, NFR-002 (QLT-833-03, SEC-833-01 to -03): what the Engineer loading ghost may hold', () => {
    /**
     * The Engineer page used to be scanned whole for the words rate, price, cost and formula, and for every word of the review. The ghost is cut out of that scan (its hints are the Engineer's own input guidance, and one of
     * them says "cost"), so it is held to something at least as strong. The scan is the security reviewer's (SEC-833-01 to -03, report pr-833-combined.md), element by element and with no search-and-delete on the markup:
     * (1) every text node is, exactly, a text of the form definition this Engineer is sent by GET /form or one of the ghost's fixed lines; (2) no comment, script, style, processing instruction or CDATA; (3) every attribute
     * is exactly one of a short list, with its exact value, and a class only of tokens that the ghost's own code defines; (4) no attribute in single quotes or with none.
     */
    const decode = (text: string): string => text.replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>');

    /** A real notice in the ghost (the locked Engineer's, the Lead's): its icon is one exact piece of markup, the one the icon component draws, and its parts carry the alert's own data-slots. Nothing else is loosened. */
    interface Allowance {
      readonly markup?: ReadonlyArray<string>;
      readonly slots?: ReadonlySet<string>;
    }

    function strictViolations(raw: string, allowedTexts: ReadonlyArray<string>, classTokens: ReadonlySet<string>, allowance: Allowance = {}): string[] {
      // The known icon is taken out by its whole text, exact and long: a changed icon is no longer that text and is scanned as it stands.
      let ghost = raw;
      for (const piece of allowance.markup ?? []) ghost = ghost.split(piece).join('');
      const problems: string[] = [];
      const allowed = new Set(allowedTexts);
      for (const match of ghost.matchAll(/>([^<>]+)</g)) {
        const text = decode(match[1] ?? '').trim();
        if (text !== '' && !allowed.has(text)) problems.push(`text: ${text}`);
      }
      if (/<!--|<script|<style|<\?|<!\[CDATA/i.test(ghost)) problems.push('comment, script or style');
      const exact: Record<string, (value: string) => boolean> = {
        inert: (value) => value === '',
        'aria-hidden': (value) => value === 'true',
        role: (value) => value === 'status',
        'aria-label': (value) => value === FORM_LOADING,
        'data-part-ghost': (value) => value === '',
        'data-ghost-wide': (value) => value === '',
        'data-ghost-picture': (value) => value === '',
        'data-ghost-grid': (value) => value === '',
        'data-slot': (value) => allowance.slots?.has(value) === true,
        style: (value) => /^--n:\d+$/.test(value),
        class: (value) => value.split(/\s+/).filter((token) => token !== '').every((token) => classTokens.has(token)),
      };
      for (const match of ghost.matchAll(/ ([a-zA-Z][\w:-]*)=(?:"([^"]*)"|'([^']*)')/g)) {
        const name = match[1] ?? '';
        const value = match[2] ?? match[3] ?? '';
        if (match[3] !== undefined || exact[name] === undefined || !exact[name](decode(value))) problems.push(`attribute: ${name}="${value}"`);
      }
      if (/ [a-zA-Z][\w:-]*=[^"'\s>]/.test(ghost)) problems.push('unquoted attribute');
      return problems;
    }

    /** The class tokens the ghost's code defines: the strings of the shared layout module and every string of the ghost and of the three components it draws with (Card, Skeleton, and the notice's), read from the code. */
    const codeOf = (path: string): string =>
      readFileSync(path, 'utf8')
        .replaceAll('\r\n', '\n')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
    function classTokensOfTheCode(withNotice = false): ReadonlySet<string> {
      const tokens = new Set<string>();
      for (const value of Object.values(layout)) if (typeof value === 'string') for (const token of value.split(/\s+/)) tokens.add(token);
      const files = ['src/components/features/estimate-workspace/part-form-ghost.tsx', 'src/components/features/estimate-workspace/surface-chips.tsx', 'src/components/ui/skeleton.tsx', 'src/components/ui/card.tsx'];
      if (withNotice) files.push('src/components/ui/alert.tsx', 'src/components/shared/notice.tsx', 'src/components/shared/break-long-names.ts', 'src/components/shared/icon.tsx');
      for (const path of files) {
        for (const literal of codeOf(path).matchAll(/(["'])((?:(?!\1)[^\n\\])*)\1/g)) {
          for (const token of (literal[2] ?? '').split(/\s+/)) if (/^[a-z0-9[!-][a-z0-9:[\]()_./&>=*,%#!~+-]*$/.test(token)) tokens.add(token);
        }
      }
      return tokens;
    }

    async function theGhostAndItsAllowedTexts(): Promise<{ readonly ghost: string; readonly allowed: ReadonlyArray<string> }> {
      harness.signInAs('ENGINEER');
      estimate().customerId = CUSTOMER_RECIPE_ID;
      const html = await open(CODE);
      const { ghost } = splitGhost(html);
      expect(ghost, 'the page draws the ghost').not.toBe('');
      const form = await harness.estimateService.getForm({ id: harness.idOf.ENGINEER, role: 'ENGINEER' }, estimate().id);
      const allowed = [
        FORM_LOADING,
        SURFACE_HINT,
        // Each card's count, in its invisible words (the block is as wide as the words the form will show): the counts of the definition's defaults, from the form's own rule.
        ...shownSections(form.sections, {}).flatMap((section) => {
          const counts = sectionProgress(section, {}, {});
          return counts.total === 0 ? [] : [`${String(counts.complete)} of ${String(counts.total)}`];
        }),
        ...form.sections.flatMap((section) => [section.name, section.columnRange, sectionLinkText(section.number, section.shortName), ...section.fields.flatMap((field) => (field.hint === null ? [] : [field.hint]))]),
      ];
      return { ghost, allowed };
    }

    it('the real ghost passes: only the form definition texts, attributes of the short list with their exact values, classes of the code, no comment or script', async () => {
      const { ghost, allowed } = await theGhostAndItsAllowedTexts();
      expect(strictViolations(ghost, allowed, classTokensOfTheCode())).toEqual([]);
      expect(allowed.length, 'the definition has texts to compare with').toBeGreaterThan(8);
    });

    it('no word of the old scan is a class token of the code (a class value is checked by token)', () => {
      const tokens = classTokensOfTheCode();
      for (const word of ['rate', 'rates', 'price', 'prices', 'cost', 'costs', 'formula', 'formulas', 'Machining', '450', '45', '$', '€', '₹']) expect(tokens.has(word), word).toBe(false);
    });

    /** The icon of an info notice, exactly as the icon component draws it, and the alert's data-slots: what a notice in a ghost may add. */
    const NOTICE_ALLOWANCE: Allowance = (() => {
      const svg = /<svg[\s\S]*?<\/svg>/.exec(renderToStaticMarkup(createElement(Notice, { tone: 'info' }, 'x')))?.[0] ?? '';
      expect(svg.length, 'the notice draws an icon').toBeGreaterThan(100);
      return { markup: [svg], slots: new Set(['alert', 'alert-description']) };
    })();

    async function theLeadGhost(): Promise<{ readonly ghost: string; readonly allowed: ReadonlyArray<string> }> {
      harness.signInAs('LEAD');
      const element = (await EstimatePage({ params: Promise.resolve({ code: CODE }), searchParams: Promise.resolve({}) })) as { props: Record<string, unknown> };
      const seed = element.props['seed'] as { form: unknown; part: unknown };
      const form = defined(parseForm(seed.form));
      const texts = defined(parsePartInputs(seed.part)).inputs;
      const { ghost } = splitGhost(renderToStaticMarkup(element as never));
      expect(ghost, 'the review draws the ghost').not.toBe('');
      const allowed = [
        FORM_LOADING,
        SURFACE_LABEL,
        SURFACE_NONE_SELECTED,
        QTY_PER_ASSY_HINT,
        inputsNotice('DRAFT', false, 'none'),
        ...shownSections(form.sections, texts).flatMap((section) => {
          const counts = sectionProgress(section, texts, {});
          return counts.total === 0 ? [] : [`${String(counts.complete)} of ${String(counts.total)}`];
        }),
        // The review look drops every hint but the quantity's (reviewField): a hint of the Engineer's form in the Lead's ghost is a violation.
        ...form.sections.flatMap((section) => [section.name, section.columnRange, sectionLinkText(section.number, section.shortName)]),
      ];
      return { ghost, allowed };
    }

    it('SEC-833-04: the Lead ghost, from the Lead seed bodies, passes the same strict scan (the review look: no hint but the quantity one; the treatments as "None selected")', async () => {
      const { ghost, allowed } = await theLeadGhost();
      expect(strictViolations(ghost, allowed, classTokensOfTheCode(true), NOTICE_ALLOWANCE)).toEqual([]);
    });

    it('QLT-833-14: the Engineer ghost of a locked estimate (its notice and icon) passes it too', async () => {
      estimate().status = 'APPROVED';
      const { ghost, allowed } = await theGhostAndItsAllowedTexts();
      expect(ghost).toContain(FORM_LOCKED);
      expect(strictViolations(ghost, [...allowed, FORM_LOCKED], classTokensOfTheCode(true), NOTICE_ALLOWANCE)).toEqual([]);
    });

    const NOTICE_MUTANTS: ReadonlyArray<{ readonly name: string; readonly change: (ghost: string) => string }> = [
      { name: 'a text "Machining rate 450.00 per hour"', change: (ghost) => ghost.replace('<div inert', () => '<span>Machining rate 450.00 per hour</span><div inert') },
      { name: 'a class value "rate"', change: (ghost) => ghost.replace(' class="', () => ' class="rate ') },
      { name: 'a title attribute', change: (ghost) => ghost.replace('<div inert', () => '<div title="Qty*Rate" inert') },
      { name: 'a changed icon (a path of the icon rewritten)', change: (ghost) => ghost.replace(/<svg[^>]*>/, (open) => open + '<text>rate 450</text>') },
      { name: 'an alert data-slot that is not the alert\'s', change: (ghost) => ghost.replace('data-slot="alert"', () => 'data-slot="rate"') },
    ];
    for (const mutant of NOTICE_MUTANTS) {
      it(`fails, for the Lead ghost and for the locked Engineer ghost, when it holds ${mutant.name}`, async () => {
        const lead = await theLeadGhost();
        const changedLead = mutant.change(lead.ghost);
        expect(changedLead, 'the mutant changed the Lead ghost').not.toBe(lead.ghost);
        expect(strictViolations(changedLead, lead.allowed, classTokensOfTheCode(true), NOTICE_ALLOWANCE), mutant.name).not.toEqual([]);
        estimate().status = 'APPROVED';
        const locked = await theGhostAndItsAllowedTexts();
        const changedLocked = mutant.change(locked.ghost);
        expect(changedLocked, 'the mutant changed the locked ghost').not.toBe(locked.ghost);
        expect(strictViolations(changedLocked, [...locked.allowed, FORM_LOCKED], classTokensOfTheCode(true), NOTICE_ALLOWANCE), mutant.name).not.toEqual([]);
      });
    }

    /** The reviewer's 23 values (SEC-833-01 to -03) put in each of 11 places, and the lane's 11 mutants: every one must fail the scan. */
    const VALUES: ReadonlyArray<string> = [
      'Machining rate 450.00 per hour', '16889808.07', 'rate', 'cost', 'formula', 'price', 'Total Unit Production Price', '450', '45', '1,234', '₹', '$', '€', '£', 'Rs 5', '=E5*F5', '=SUM(E5:E9)/G3', 'Qty*Rate',
      '４５０.００', '٤٥٠', '＄5', 'ra&#8203;te', 'ｒａｔｅ 450',
    ];
    const PLACES: ReadonlyArray<{ readonly name: string; readonly put: (ghost: string, value: string) => string }> = [
      { name: 'a text node', put: (ghost, value) => ghost.replace('<div inert', () => `<span>${value}</span><div inert`) },
      { name: 'a class value', put: (ghost, value) => ghost.replace(' class="', () => ` class="${value} `) },
      { name: 'a data-ghost value', put: (ghost, value) => ghost.replace('data-ghost-grid=""', () => `data-ghost-grid="${value}"`) },
      { name: 'an aria-busy value', put: (ghost, value) => ghost.replace('<div inert', () => `<div aria-busy="${value}" inert`) },
      { name: 'an aria-hidden value', put: (ghost, value) => ghost.replace('aria-hidden="true"', () => `aria-hidden="${value}"`) },
      { name: 'an inert value', put: (ghost, value) => ghost.replace('<div inert=""', () => `<div inert="${value}"`) },
      { name: 'a style value', put: (ghost, value) => ghost.replace('style="--n:', () => `style="${value};--n:`) },
      { name: 'an unlisted attribute (title)', put: (ghost, value) => ghost.replace('<div inert', () => `<div title="${value}" inert`) },
      { name: 'a single-quoted attribute', put: (ghost, value) => ghost.replace('<div inert', () => `<div data-x='${value}' inert`) },
      { name: 'an HTML comment', put: (ghost, value) => ghost.replace('<div inert', () => `<!--${value}--><div inert`) },
      { name: 'a script block', put: (ghost, value) => ghost.replace('<div inert', () => `<script>${value}</script><div inert`) },
    ];
    for (const place of PLACES) {
      it(`fails when ${place.name} holds any of the ${String(VALUES.length)} values`, async () => {
        const { ghost, allowed } = await theGhostAndItsAllowedTexts();
        const tokens = classTokensOfTheCode();
        const survivors = VALUES.filter((value) => {
          const changed = place.put(ghost, value);
          return changed === ghost || strictViolations(changed, allowed, tokens).length === 0;
        });
        expect(survivors, `values that passed in ${place.name}`).toEqual([]);
      });
    }

    /** The lane's own mutants, and the cases of the old whole-page scan. */
    const OTHER: ReadonlyArray<{ readonly name: string; readonly change: (ghost: string) => string }> = [
      { name: 'a hint with a word added to it', change: (ghost) => ghost.replace('Enter 0 if there is none.', 'Enter 0 if there is none. rate') },
      { name: 'a text holding a section number, "1 rate"', change: (ghost) => ghost.replace('<div inert', '<span>1 rate</span><div inert') },
      { name: 'a word of the old scan in an attribute (aria-description="formula")', change: (ghost) => ghost.replace('<div inert', '<div aria-description="formula" inert') },
      { name: 'a data attribute (data-price="12")', change: (ghost) => ghost.replace('<div inert', '<div data-price="12" inert') },
      { name: 'a word of the review, "File cell"', change: (ghost) => ghost.replace('<div inert', '<span>File cell</span><div inert') },
      { name: 'a text split across three elements', change: (ghost) => ghost.replace('<div inert', '<span>Mach</span><span>ining rate</span><span> 450.00</span><div inert') },
    ];
    for (const mutant of OTHER) {
      it(`fails when the ghost holds ${mutant.name}`, async () => {
        const { ghost, allowed } = await theGhostAndItsAllowedTexts();
        const changed = mutant.change(ghost);
        expect(changed, 'the mutant changed the ghost').not.toBe(ghost);
        expect(strictViolations(changed, allowed, classTokensOfTheCode()), mutant.name).not.toEqual([]);
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
