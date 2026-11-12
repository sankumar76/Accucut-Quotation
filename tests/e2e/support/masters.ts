import { randomBytes } from 'node:crypto';

import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

import { waitUntilHydrated } from './design-system';
import { DEVELOPMENT_URL } from './servers';
import { afterOneFrame, BUSY, JSON_HEADERS, SAVED_BUT_NOT_SHOWN } from './treatments';

/**
 * What the two masters specs of the shared pieces share (GitHub issues 244 and 277): `masters-slow-read.spec.ts` (where focus goes when the
 * list is read again slowly after a save) and `masters-dialog-opener.spec.ts` (the first open of the dialogs). The Process master (SCR-11) and
 * the Materials tab (SCR-13) opened on their pages, the rows a test makes for itself through the API, and a gate on the list's GET. The words
 * are the UX spec's, written out. Invented names and numbers only (`n.37`, ADR-014). No tests here.
 */

/** UX spec SCR-11 and SCR-13, written out. */
export const PROCESS_TITLE = 'Process master';
export const PROCESS_LOAD_ERROR = 'We could not load the rates';
export const PROCESS_LOADING = 'Loading the rates';
export const MATERIALS_TITLE = 'Materials and lists';
export const MATERIALS_LOAD_ERROR = 'We could not load the materials';
export const MATERIALS_LOADING = 'Loading the materials';

/** UX spec SCR-25 and SCR-14 "A dialog that does not open": the two titles of the notice, and its sentence. */
export const FORM_DID_NOT_OPEN = 'The form did not open.';
export const CONFIRMATION_DID_NOT_OPEN = 'The confirmation did not open.';
export const CHECK_YOUR_CONNECTION = 'Check your connection and try again.';

/** Seed rates of the Process master that a test only presses and never saves or deletes: the first no formula uses (so Delete asks for a confirmation). */
export const SEED_RATE = 'Plating-rate-per-sqin';
export const OTHER_SEED_RATE = 'Welding-rate-per-kg';

const PROCESS_API = `${DEVELOPMENT_URL}/api/v1/process-items`;
const MATERIALS_API = `${DEVELOPMENT_URL}/api/v1/materials`;

/** The list reads of each screen, as the route patterns of a gate take them. */
export const PROCESS_LIST_PATH = '/api/v1/process-items';
export const MATERIALS_LIST_PATH = '/api/v1/materials';

/** A name nobody else has: it carries the screen size, the repeat and the retry, plus a random part. */
function newName(kind: string, testInfo: TestInfo): string {
  return `E2E-${kind}-${testInfo.project.name}-r${testInfo.repeatEachIndex}-t${testInfo.retry}-${randomBytes(3).toString('hex')}`;
}

/** Makes a rate through the API, the way the screen does, and returns its name. Its default value is 1.37. */
export async function makeRate(page: Page, testInfo: TestInfo): Promise<string> {
  const name = newName('rate', testInfo);
  const response = await page.request.post(PROCESS_API, { headers: JSON_HEADERS, data: { name, unit: 'per kg', defaultValue: '1.37' } });
  expect(response.status()).toBe(201);
  return name;
}

/** Makes a material through the API, the way the screen does, and returns its name (Material in Drawing). Its scrap rate is 22.37. */
export async function makeMaterial(page: Page, testInfo: TestInfo): Promise<string> {
  const name = newName('material', testInfo);
  const data = { materialInDrawing: name, materialConsidered: 'Invented mild steel', pricePerKg: '58.37', specificGravity: '7.37', scrapRate: '22.37' };
  const response = await page.request.post(MATERIALS_API, { headers: JSON_HEADERS, data });
  expect(response.status()).toBe(201);
  return name;
}

async function openScreen(page: Page, route: string, title: string): Promise<void> {
  await page.goto(route);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  // The buttons are plain HTML until React has attached their handlers; a press before that is lost (DEF-011).
  await waitUntilHydrated(page, 'main button[data-action="add"]');
}

export const openProcessMaster = (page: Page): Promise<void> => openScreen(page, '/masters/process', PROCESS_TITLE);
export const openMaterials = (page: Page): Promise<void> => openScreen(page, '/masters/materials', MATERIALS_TITLE);

/** A button of a row (table) or card (phone) of a rate or a material, whichever of the two is shown. */
export function rowButton(page: Page, name: string, button: string): Locator {
  return page
    .locator('[data-item-id]:visible')
    .filter({ hasText: name })
    .getByRole('button', { name: `${button} ${name}` });
}

/** Presses a button with the keyboard, the way a person who does not use a pointer does. */
export async function pressWithKeyboard(button: Locator): Promise<void> {
  await button.focus();
  await button.press('Enter');
}

/**
 * Sits in front of the GET of one list (`/api/v1/process-items`, `/api/v1/materials`) and holds the reads the test says to hold. Nothing else is touched: the
 * write of a save goes through, and so does a read made while the gate is not holding. When a held read is let go it answers as the server does, or as a busy
 * server (503), so the test chooses between a list that arrives late and one that never does.
 */
export interface ListGate {
  /** From now on, a read of the list waits. */
  readonly hold: () => void;
  /** How many reads are waiting. */
  readonly waiting: () => number;
  /** Lets the waiting reads go, and every later one. */
  readonly release: (answer: 'server' | 'busy') => void;
}

export async function gateListReads(page: Page, path: string): Promise<ListGate> {
  let holding = false;
  let waiting = 0;
  let decision: Promise<'server' | 'busy'> = Promise.resolve('server');
  let decide: (answer: 'server' | 'busy') => void = () => undefined;
  await page.route(`**${path}`, async (route) => {
    if (route.request().method() !== 'GET' || !holding) return route.continue();
    waiting += 1;
    return (await decision) === 'busy' ? route.fulfill(BUSY) : route.continue();
  });
  return {
    hold: () => {
      holding = true;
      decision = new Promise((resolve) => {
        decide = resolve;
      });
    },
    waiting: () => waiting,
    release: (answer) => {
      holding = false;
      decide(answer);
    },
  };
}

/**
 * DEF-020: the change succeeded and the read after it failed. The load error is on the page with focus on its title; the page heading never took focus;
 * the sequence of elements that took focus ends on the title (a look at `document.activeElement` alone would pass for a fault that takes focus away a moment
 * later); and a poll finds it still there. `focusLog` is the sequence recorded from before the read answers (`recordFocus`).
 */
export async function expectLoadErrorHoldsFocus(page: Page, focusLog: ReadonlyArray<string>, errorTitle: string): Promise<void> {
  const title = page.getByRole('heading', { name: errorTitle });
  await expect(title).toBeVisible();
  await afterOneFrame(page);
  expect(focusLog, 'the load error took focus').toContain(`H2:${errorTitle}`);
  expect(focusLog.filter((entry) => entry.startsWith('H1:')), 'the page heading never took focus').toEqual([]);
  expect(focusLog.at(-1), 'the last element to take focus is the title').toBe(`H2:${errorTitle}`);
  await expect(title).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.activeElement?.textContent ?? ''), { message: 'focus stays on the error title' }).toBe(errorTitle);
}

const SUCCESS_NOTICE_SENTENCE = 'The change is in the audit log.';
const NOTHING_WAS_CHANGED = 'Nothing was changed.';

/**
 * DEF-029 (AQP-274): the same moment, read for its words. A success notice ("... saved.") is on the page, so the load error says the change was saved
 * and never "Nothing was changed." (ux-spec v0.23, SCR-11 "The Error (load) after a change that was saved" and SCR-13 "Loading and Error (load) of the Materials
 * tab"). The notice is checked first, so the test cannot pass on a page where the save did not happen or the notice never showed.
 */
export async function expectSavedNotShown(page: Page): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: SUCCESS_NOTICE_SENTENCE }), 'the success notice is still on the page').toBeVisible();
  await expect(page.getByText(SAVED_BUT_NOT_SHOWN), 'the load error says the change was saved').toBeVisible();
  await expect(page.getByText(NOTHING_WAS_CHANGED), 'a save that succeeded never reads "Nothing was changed."').toHaveCount(0);
}
