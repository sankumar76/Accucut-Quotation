import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { expect, type Locator, type Page } from '@playwright/test';
import { z } from 'zod';

import { FIELD_ID_NAMESPACE, seedId } from '../../../prisma/seed/config/seed-sections-and-stages';
import { columnLetterToIndex } from '../../../src/lib/columns';
import { CUSTOMER_CANARIES } from '../../support/customer-canary';
import { defined } from '../../support/defined';
import { E2E_ADMIN, E2E_LEAD, type E2eUser } from '../../e2e/support/auth';
import { horizontalOverflow } from '../../e2e/support/design-system';
import type { PrimaryAction, SweepRole, SweepRow } from '../screens-table';

/**
 * What the sweep's specs share (STORY-10.08, AQP-370): the data the set-up project seeded, the three people the sweep signs in as, the address of a row's page, and the two checks that
 * every page gets (no sideways scroll, and each declared primary action reachable). This file has no tests and its name does not end in `.spec.ts`.
 */

/** Where the set-up project writes what it seeded; `test-results/` is ignored by git and is not the output folder of the run, so the run's clean-up leaves it alone. */
export const SWEEP_DATA_FILE = 'test-results/sweep-data.json';

const estimateShape = z.object({ code: z.string().min(1), ownerEmail: z.string().min(1) });
const dataShape = z.object({
  /** An estimate that has been calculated (the Lead's review, the cost details, the export). */
  calculated: estimateShape,
  /** An estimate that is still a draft, whose owner is the sweep's Engineer (the form). */
  draft: estimateShape,
});
export type SweepData = z.infer<typeof dataShape>;

export function writeSweepData(data: SweepData): void {
  mkdirSync(dirname(SWEEP_DATA_FILE), { recursive: true });
  writeFileSync(SWEEP_DATA_FILE, JSON.stringify(data));
}

let cached: SweepData | undefined;

/** The seeded data, read once by each worker. Fails with a clear message when the set-up project has not run, instead of a later timeout. */
export function loadSweepData(): SweepData {
  if (cached !== undefined) return cached;
  let text: string;
  try {
    text = readFileSync(SWEEP_DATA_FILE, 'utf8');
  } catch {
    throw new Error(`The sweep's seeded data is missing (${SWEEP_DATA_FILE}). The "setup" project makes it; run the whole configuration, not one spec on its own.`);
  }
  cached = dataShape.parse(JSON.parse(text));
  return cached;
}

/** The invented customer the canary set holds, which `ensureCanaryCustomers` makes sure exists, and the registry's field AX, which has a formula to edit. */
const CUSTOMER_ID = defined(CUSTOMER_CANARIES[0]).id;
const FORMULA_FIELD_ID = seedId(FIELD_ID_NAMESPACE, columnLetterToIndex('AX'));

/** The person the sweep signs in as for a role. The Engineer is the owner of the draft estimate, so the form is the Engineer's own. */
export function personaOf(role: SweepRole, data: SweepData): E2eUser {
  if (role === 'ADMIN') return E2E_ADMIN;
  if (role === 'LEAD') return E2E_LEAD;
  return { name: 'Sweep Engineer', email: data.draft.ownerEmail, role: 'ENGINEER' };
}

/** The address of a row's page: the row's route with its dynamic parts filled from the seeded data. */
export function pathOf(row: Pick<SweepRow, 'route' | 'estimate'>, data: SweepData): string {
  const code = encodeURIComponent((row.estimate === 'draft' ? data.draft : data.calculated).code);
  return row.route
    .replace('/customers/[id]', `/customers/${CUSTOMER_ID}`)
    .replace('/fields/[id]', `/fields/${FORMULA_FIELD_ID}`)
    .replace('[code]', code)
    .replace('[slNo]', '1');
}

/** A title for a test: the screen, the route and the role, so a failure in the report names page and role (AC-8). */
export function titleOf(row: Pick<SweepRow, 'screen' | 'route' | 'variant'>, role: SweepRole): string {
  return `${row.screen}, ${row.route}${row.variant === undefined ? '' : ` (${row.variant})`}, as ${role}`;
}

/**
 * Waits until the page has finished loading what it shows: the document is complete and nothing on it is a skeleton or marked busy. A list page loads its rows after the first paint, and
 * a scan of the skeleton would say nothing about the page. No sleep: it waits for a state.
 *
 * Only a skeleton that is drawn counts: the figure tiles of SCR-06 hold a skeleton that is `display: none` until a recalculation is under way (`figure-tiles.tsx`), so on a settled review the element
 * is in the document and not on the screen. A box with no client rectangles is not drawn.
 */
export async function waitUntilSettled(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      document.readyState === 'complete' &&
      document.querySelector('[aria-busy="true"]') === null &&
      [...document.querySelectorAll('[data-slot="skeleton"]')].every((skeleton) => skeleton.getClientRects().length === 0),
  );
}

export function locatorOf(page: Page, action: PrimaryAction): Locator {
  if (action.kind === 'css') return page.locator(action.selector).first();
  const scope = action.inMain === true ? page.getByRole('main') : page;
  return scope.getByRole(action.kind, { name: action.name, ...(action.exact === true ? { exact: true } : {}) }).first();
}

export const labelOf = (action: PrimaryAction): string => (action.kind === 'css' ? action.label : `${action.kind} "${action.name}"`);

/**
 * AC-1: the action scrolls into view and nothing covers it. The page is scrolled the way a person scrolls (the element to the middle of the window, as far as the page allows), then
 * the element at the middle of the action's box must be the action itself or something inside it: a sticky bar over it, or a box that has slid under the window's edge, fails.
 */
export async function expectReachable(page: Page, action: PrimaryAction): Promise<void> {
  const target = locatorOf(page, action);
  const label = labelOf(action);
  await expect(target, `${label} is on the page`).toBeVisible();
  await target.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
  const state = await target.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const top = document.elementFromPoint(x, y);
    return {
      inside: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight,
      // `contains` is true for the element itself.
      uncovered: top !== null && element.contains(top),
      coveredBy: top === null ? 'nothing' : `${top.tagName.toLowerCase()}${top.id === '' ? '' : `#${top.id}`}`,
    };
  });
  expect(state.inside, `${label} sits inside the window after it is scrolled into view`).toBe(true);
  expect(state.uncovered, `${label} is covered by ${state.coveredBy}`).toBe(true);
}

/** AC-1, AC-5: the document is not wider than the window, so the page does not scroll sideways. */
export async function expectNoSidewaysScroll(page: Page, where: string): Promise<void> {
  expect(await horizontalOverflow(page), `the page scrolls sideways ${where}`).toBeLessThanOrEqual(0);
}
