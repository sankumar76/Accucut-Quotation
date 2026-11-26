import { expect, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';

import type { PartItem } from '../../../src/lib/estimates/tree-client';

import { useFreshAddress as freshAddressFor, type E2eUser } from './auth';
import { signInAs } from './calculated-estimate';
import { DEVELOPMENT_URL } from './servers';

/**
 * The Lead's and the Admin's parts tree on SCR-06 (DEF-131 stage 2T; UX ruling `lead-admin-edit-inputs-2026-11-27.md` 4.7, checks ED-18 to ED-37). The tree is the `nav` named "Parts tree", as on SCR-05, and a row is its
 * link, whose number is the text marked `data-sl-no`. The toolbar of a row is in view on the hovered row (a mouse), on the open row (a finger) and on a row that holds the keyboard focus, so a case chooses the row first,
 * as a person does. The words are the ruling's, written out here and not imported. Every name is invented.
 */

const escaped = (slNo: string): string => slNo.replaceAll('.', '\\.');

export const reviewTree = (page: Page): Locator => page.getByRole('navigation', { name: 'Parts tree' });
export const reviewRow = (page: Page, slNo: string): Locator =>
  reviewTree(page)
    .getByRole('link')
    .filter({ has: page.locator('[data-sl-no]', { hasText: new RegExp(`^${escaped(slNo)}$`) }) });
/** A button of one row: its name starts with the words and the number of its row ("Add under 1 ", "Delete 1.1 ", "Move 1.1 "). */
export const reviewButton = (page: Page, words: string, slNo: string): Locator => reviewTree(page).getByRole('button', { name: new RegExp(`^${words} ${escaped(slNo)} `) });
export const addMainAssemblyButton = (page: Page): Locator => page.getByRole('button', { name: 'Add main assembly' });
export const slNumbersOf = (page: Page): Promise<string[]> => reviewTree(page).locator('[data-sl-no]').allTextContents();

/** Below 1024 px the tree is the foldable panel and it folds after a row is chosen: opens it again when it is closed. */
export async function openTreePanel(page: Page): Promise<void> {
  const panel = page.locator('details[data-review-tree]');
  if (!(await panel.evaluate((element) => (element as HTMLDetailsElement).open))) await panel.locator('summary').click();
}

/** Chooses a row by a press on its link (a mouse hovers it first, which brings its toolbar into view). */
export async function chooseRow(page: Page, slNo: string): Promise<void> {
  await openTreePanel(page);
  await reviewRow(page, slNo).click();
}

/**
 * ED-18, ED-33: once the island has read the tree, every row has the move handle and "-" (and "+" unless it is a Fastener) in its toolbar slot, "Add main assembly" is in the foot, and there is no resize handle and no
 * "Tree width" button. The toolbar is clipped when not in view, but always in the page and the tab order.
 */
export async function expectTreeControls(page: Page): Promise<void> {
  await expect(addMainAssemblyButton(page)).toBeVisible();
  const rows = reviewTree(page).locator('[data-part-row]');
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const slot = rows.nth(index).locator('[data-row-toolbar]').first();
    await expect(slot.getByRole('button', { name: /^Move / })).toHaveCount(1);
    await expect(slot.getByRole('button', { name: /^Delete / })).toHaveCount(1);
  }
  await expect(page.getByRole('button', { name: /Tree width/ })).toHaveCount(0);
  await expect(page.getByRole('separator')).toHaveCount(0);
}

/** The number of times the page was asked for again by the router (`?_rsc=`), from now on. */
export function countPageReads(page: Page): () => number {
  let reads = 0;
  page.on('request', (request) => {
    if (request.method() === 'GET' && request.url().includes('_rsc=')) reads += 1;
  });
  return () => reads;
}

export const CLEARED_STATUS = 'The parts changed. Every calculated figure is cleared. Press Recalculate to see them again.';

/**
 * The Engineer's own window onto the same estimate (a context of its own, the same person, no new one): signs in through the two calls the sign-in page makes and gives the page's request context, which reads and
 * writes as the Engineer does. The caller closes it.
 */
export async function openEngineerWindow(browser: Browser, owner: E2eUser): Promise<{ readonly api: APIRequestContext; readonly close: () => Promise<void> }> {
  const window = await browser.newContext({ baseURL: DEVELOPMENT_URL });
  await freshAddressFor(window);
  const windowPage = await window.newPage();
  await signInAs(windowPage, owner);
  return { api: windowPage.request, close: () => window.close() };
}

/** The tree as the server holds it, read through a request context. */
export async function readTreeThrough(api: APIRequestContext, estimateId: string): Promise<ReadonlyArray<PartItem>> {
  const response = await api.get(`/api/v1/estimates/${estimateId}/tree`);
  expect(response.status()).toBe(200);
  return ((await response.json()) as { nodes: ReadonlyArray<PartItem> }).nodes;
}
