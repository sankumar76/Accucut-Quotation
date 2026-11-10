import { randomBytes } from 'node:crypto';

import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

import { waitUntilHydrated } from './design-system';
import { DEVELOPMENT_URL } from './servers';

/**
 * What the Treatment / Color specs share (STORY-02.05): the words of SCR-13 written out, the page opened on its tab, the rows a test makes for itself
 * through the API, and the focus recorder. Each test works on treatments it makes (an invented name with the screen size, the repeat, the retry and a
 * random part), so the three screen sizes and the retries never meet on one treatment. No test here waits for a fixed time.
 */

/** UX spec SCR-13, written out. */
export const TITLE = 'Materials and lists';
export const TAB = 'Treatment / Color';
export const LOCKED_REASON = 'Always offered; the Engineer types the text';
export const NAME_REQUIRED = 'Enter a name.';
export const NAME_TAKEN = 'A treatment with this name already exists.';
export const NAME_RESERVED = 'That name cannot be used.';
export const LOAD_ERROR_TITLE = 'We could not load the treatments';
export const SAVED_BUT_NOT_SHOWN = 'The change was saved, but we could not show the list. Check your connection and try again.';
export const FAILED_WITH_FORM = 'Check your connection and try again. What you typed is still in the form.';
export const FAILED_PLAIN = 'Check your connection and try again.';
export const API = `${DEVELOPMENT_URL}/api/v1/treatments`;
export const JSON_HEADERS = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };

/** A 503 as the server answers when the database is busy. */
export const BUSY = {
  status: 503,
  contentType: 'application/problem+json',
  body: JSON.stringify({ type: 'about:blank', title: 'The service is busy. Try again in a moment.', status: 503, code: 'DATABASE_BUSY', requestId: 'req-0a0b0c0d' }),
};

/** The row (table) or card (phone) of a treatment: whichever of the two is shown. */
export function rowOf(page: Page, name: string): Locator {
  return page.locator('[data-item-id]:visible').filter({ hasText: name });
}

/** A treatment name nobody else has: it carries the screen size, the repeat and the retry, plus a random part. */
export function newTreatmentName(testInfo: TestInfo): string {
  return `E2E-treatment-${testInfo.project.name}-r${testInfo.repeatEachIndex}-t${testInfo.retry}-${randomBytes(3).toString('hex')}`;
}

/** Makes a treatment through the API, the way the screen does, and returns its name and ID. */
export async function makeTreatment(page: Page, name: string): Promise<{ readonly name: string; readonly id: string }> {
  const response = await page.request.post(API, { headers: JSON_HEADERS, data: { name } });
  expect(response.status()).toBe(201);
  const body: unknown = await response.json();
  const id = typeof body === 'object' && body !== null && 'id' in body && typeof body.id === 'string' ? body.id : '';
  expect(id).not.toBe('');
  return { name, id };
}

/** The visible row (table) or card (phone) of the locked entry. The text is in both layouts, one of them hidden, so a text locator would match twice. */
export function lockedRow(page: Page): Locator {
  return page.locator('[data-item-id]:visible').filter({ hasText: LOCKED_REASON });
}

/** Opens the page on the Materials tab, waits for the page to be live, and opens the Treatment / Color tab with its list on the screen. */
export async function openTreatments(page: Page): Promise<void> {
  await page.goto('/masters/materials');
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  // The buttons are plain HTML until React has attached their handlers; a press before that is lost (DEF-011).
  await waitUntilHydrated(page, 'main button[data-action="add"]');
  await page.getByRole('tab', { name: TAB }).click();
  await expect(page.getByRole('button', { name: 'Add treatment' })).toBeVisible();
  await expect(lockedRow(page)).toBeVisible();
}

/** Presses a button with the keyboard, the way a person who does not use a pointer does. */
export async function pressWithKeyboard(button: Locator): Promise<void> {
  await button.focus();
  await button.press('Enter');
}

/**
 * Records every element that takes focus from now on, in order, as "TAG:text". A single look at `document.activeElement` would pass for a fault that
 * takes focus away a moment after the error appeared (DEF-020 did exactly that), so a test reads the whole sequence.
 */
export async function recordFocus(page: Page): Promise<string[]> {
  const log: string[] = [];
  await page.exposeFunction('recordFocus', (entry: string) => log.push(entry));
  await page.evaluate(() => {
    document.addEventListener(
      'focusin',
      (event) => {
        const target = event.target instanceof Element ? event.target : null;
        void Reflect.get(window, 'recordFocus')(`${target?.tagName ?? 'none'}:${target?.textContent ?? ''}`);
      },
      true,
    );
  });
  return log;
}

/** Lets what the page has already queued reach the test: one frame, then the round trip of the next call. */
export const afterOneFrame = (page: Page): Promise<void> => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

/** Makes `GET /api/v1/treatments` answer 503 from the moment `fail.value` is true, and lets every other call through. */
export async function failListWhen(page: Page): Promise<{ value: boolean }> {
  const fail = { value: false };
  await page.route('**/api/v1/treatments', (route) => (route.request().method() === 'GET' && fail.value ? route.fulfill(BUSY) : route.continue()));
  return fail;
}
