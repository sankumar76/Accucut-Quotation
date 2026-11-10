import { expect, test, type Page, type Request, type Route } from '@playwright/test';
import { z } from 'zod';

import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { EXCHANGE_RATE_CANARIES } from '../support/exchange-rate-canary';

import { ADMIN_STATE, DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-02.04 T5 (AC-1 to AC-3, AC-5, AC-7; DEF-020 guard): SCR-13 "Materials and lists", the Exchange rates tab, at 360x800, 768x1024 and
 * 1366x768 on the development server, signed in as the E2E Admin (the saved browser state of the set-up project). No sideways scroll, axe 0
 * violations, targets of 44 px, money fields with `inputmode="decimal"`, and the whole form by keyboard.
 *
 * There is ONE pair of exchange rates in the database and three screen sizes run at once, so no test here relies on what the database holds after
 * another test may have saved. The tests that show stored values answer `GET /api/v1/exchange-rates` themselves (a fixed pair, or "not set yet").
 * The tests that really save send only the canary pair (`CANARY_PAIR`), whatever the screen shows as stored, so the pair in the database is always
 * the one the confidentiality scan looks for (QLT-02) and a retry meets the same state as the first attempt (QLT-10); they judge the request, the
 * server's answer to it, and the screen. Persistence, the audit entry and the stamp are judged against PostgreSQL in
 * `tests/integration/masters/exchange-rates.test.ts`. The words are the UX spec's, written out here.
 * Names and numbers are invented (`n.37`, ADR-014), except inputs that test the format.
 *
 * Width: none of these tests carries the one-width tag: test strategy section 10.5 has not ruled on this file, and every test reads layout or focus, so each runs at three widths.
 */

test.use({ storageState: ADMIN_STATE });

/** UX spec SCR-13, written out. */
const NUMBER_MESSAGE = 'Enter a number, 0 or more, with up to 2 decimals.';
const LABEL_USD = '1 USD in ₹';
const LABEL_EUR = '1 EUR in ₹';
const LOAD_ERROR_TITLE = 'We could not load the exchange rates';
const SAVED_NOTICE = 'Exchange rates saved.';
const NOTHING_TO_SAVE_NOTICE = 'You have not changed either rate, so there is nothing to save.';
const FAILED_SAVE_BODY = 'Check your connection and try again. What you typed is still in the form.';
const SAVED_BUT_NOT_SHOWN_BODY = 'The exchange rates were saved, but we could not show them. Check your connection and try again.';
const API = `${DEVELOPMENT_URL}/api/v1/exchange-rates`;
const JSON_HEADERS = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };

/** A pair that was saved: 15:10 IST on 2 Nov 2026 is 09:40 UTC. */
const STORED = {
  usd: '81.37',
  eur: '88.37',
  updatedBy: 'Invented Admin',
  updatedAt: '2026-11-02T09:40:00.000Z',
  columns: {
    usd: { rate: { letter: 'BH', label: 'Exchange Rate USD' }, price: { letter: 'BJ', label: 'Unit Production Price (USD)' } },
    eur: { rate: { letter: 'BI', label: 'Exchange Rate EUR' }, price: { letter: 'BK', label: 'Unit Production Price (EUR)' } },
  },
} as const;
const NOT_SET = { ...STORED, usd: null, eur: null, updatedBy: null, updatedAt: null };

const problem = (status: number, code: string, title: string) => ({
  status,
  contentType: 'application/problem+json',
  body: JSON.stringify({ type: 'about:blank', title, status, code, requestId: 'req-0a0b0c0d' }),
});
const BUSY = problem(503, 'DATABASE_BUSY', 'The service is busy. Try again in a moment.');

/**
 * The only rates a test here really saves: the canary pair of the scan (invented, `tests/support/exchange-rate-canary.ts`). The database keeps this
 * pair whenever a save happens, so no save here can change what the scan looks for while it runs. The page is told the stored pair is another one
 * (`STORED`), so sending these is a change on screen and a real request, and the server finds them already stored and writes nothing.
 */
const CANARY_PAIR = { usd: EXCHANGE_RATE_CANARIES.usd, eur: EXCHANGE_RATE_CANARIES.eur };

/** Answers `GET /api/v1/exchange-rates` with a fixed body, and lets every other call through. */
async function answerGetWith(page: Page, body: unknown): Promise<void> {
  await page.route('**/api/v1/exchange-rates', (route) =>
    route.request().method() === 'GET' ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }) : route.continue(),
  );
}

/** Opens the page on the Materials tab, waits for the page to be live, and opens the Exchange rates tab. */
async function openExchangeRates(page: Page): Promise<void> {
  await page.goto('/masters/materials');
  await expect(page.getByRole('heading', { level: 1, name: 'Materials and lists' })).toBeVisible();
  // The buttons are plain HTML until React has attached their handlers; a press before that is lost (DEF-011).
  await waitUntilHydrated(page, 'main button[data-action="add"]');
  await page.getByRole('tab', { name: 'Exchange rates' }).click();
}

async function openWithForm(page: Page): Promise<void> {
  await openExchangeRates(page);
  await expect(page.getByLabel(LABEL_USD)).toBeVisible();
}

/** The PUT requests the page sends from now on, with their bodies. */
function recordPuts(page: Page): Array<{ readonly body: unknown }> {
  const sent: Array<{ readonly body: unknown }> = [];
  page.on('request', (request: Request) => {
    if (request.method() !== 'PUT' || !request.url().endsWith('/api/v1/exchange-rates')) return;
    const body: unknown = request.postDataJSON();
    sent.push({ body });
  });
  return sent;
}

/**
 * Records every element that takes focus from now on, in order, as "TAG:text". A single look at `document.activeElement` would pass for a fault that
 * takes focus away a moment after the error appeared (DEF-020 did exactly that), so the test reads the whole sequence.
 */
async function recordFocus(page: Page): Promise<string[]> {
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
const afterOneFrame = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

test.describe('the tab and its form (AC-1, AC-5, AC-7)', () => {
  test('AC-1, AC-5, AC-7: two labelled fields, the stored values, the stamp in IST as text, and the hints with the letters of the registry; no sideways scroll, axe 0 violations', async ({ page }) => {
    await answerGetWith(page, STORED);
    await openWithForm(page);
    await expect(page.getByRole('tab', { name: 'Exchange rates' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Exchange rates' })).toBeVisible();
    await expect(page.getByLabel(LABEL_USD)).toHaveValue('81.37');
    await expect(page.getByLabel(LABEL_EUR)).toHaveValue('88.37');
    await expect(page.getByText('Last updated by Invented Admin, 02 Nov 2026, 15:10 IST.')).toBeVisible();
    await expect(page.getByText('Converts prices to US dollars. The rate (BH) feeds Unit Production Price (USD), BJ.')).toBeVisible();
    await expect(page.getByText('Converts prices to euros. The rate (BI) feeds Unit Production Price (EUR), BK.')).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-5: the hints are made from the letters the server sends, not typed: other letters in the answer give other letters on the screen', async ({ page }) => {
    const relettered = { ...STORED, columns: { ...STORED.columns, usd: { rate: { letter: 'ZA', label: 'x' }, price: { letter: 'ZC', label: 'Moved price' } } } };
    await answerGetWith(page, relettered);
    await openWithForm(page);
    await expect(page.getByText('Converts prices to US dollars. The rate (ZA) feeds Moved price, ZC.')).toBeVisible();
    await expect(page.getByText('(BH)')).toHaveCount(0);
  });

  test('AC-5: against the real server, the hints name the columns BH, BJ, BI and BK of the registry', async ({ page }) => {
    await openWithForm(page);
    await expect(page.getByText('Converts prices to US dollars. The rate (BH) feeds Unit Production Price (USD), BJ.')).toBeVisible();
    await expect(page.getByText('Converts prices to euros. The rate (BI) feeds Unit Production Price (EUR), BK.')).toBeVisible();
  });

  test('AC-1: "Not set yet" while no rate exists: empty fields that say so, and no stamp line', async ({ page }) => {
    await answerGetWith(page, NOT_SET);
    await openWithForm(page);
    await expect(page.getByLabel(LABEL_USD)).toHaveValue('');
    await expect(page.getByLabel(LABEL_USD)).toHaveAttribute('placeholder', 'Not set yet');
    await expect(page.getByLabel(LABEL_EUR)).toHaveAttribute('placeholder', 'Not set yet');
    await expect(page.getByText(/Last updated by/)).toHaveCount(0);
  });

  test('AC-7: the controls are at least 44 px high, and both money fields use inputmode="decimal"', async ({ page }) => {
    await answerGetWith(page, STORED);
    await openWithForm(page);
    for (const control of [page.getByLabel(LABEL_USD), page.getByLabel(LABEL_EUR), page.getByRole('button', { name: 'Save exchange rates' }), page.getByRole('tab', { name: 'Exchange rates' })]) {
      expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    await expect(page.getByLabel(LABEL_USD)).toHaveAttribute('inputmode', 'decimal');
    await expect(page.getByLabel(LABEL_EUR)).toHaveAttribute('inputmode', 'decimal');
  });
});

test.describe('saving (AC-2, AC-3, AC-7)', () => {
  test('AC-2, AC-7: by keyboard only: the tab opens with the arrow key, Tab reaches both fields and Save, Enter in a field saves both rates together, and focus is back on Save', async ({ page }) => {
    const values = CANARY_PAIR;
    await answerGetWith(page, STORED);
    const sent = recordPuts(page);
    await page.goto('/masters/materials');
    await waitUntilHydrated(page, 'main button[data-action="add"]');
    await page.getByRole('tab', { name: 'Materials' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByLabel(LABEL_USD)).toBeVisible();

    await page.getByLabel(LABEL_USD).focus();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(values.usd);
    await page.keyboard.press('Tab');
    await expect(page.getByLabel(LABEL_EUR)).toBeFocused();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(values.eur);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Save exchange rates' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    const answered = page.waitForResponse((response) => response.request().method() === 'PUT' && response.url().endsWith('/api/v1/exchange-rates'));
    await page.keyboard.press('Enter');

    const response = await answered;
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ usd: values.usd, eur: values.eur });
    expect(sent).toEqual([{ body: values }]);
    await expect(page.getByRole('status').filter({ hasText: SAVED_NOTICE })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save exchange rates' })).toBeFocused();
  });

  test('AC-3: a blank, negative, non-numeric or three-decimal value says so under its field, keeps what was typed, puts focus on the first message, and sends nothing', async ({ page }) => {
    await answerGetWith(page, STORED);
    const sent = recordPuts(page);
    await openWithForm(page);
    await page.getByLabel(LABEL_USD).fill('');
    await page.getByLabel(LABEL_EUR).fill('88.371');
    await page.getByRole('button', { name: 'Save exchange rates' }).click();
    await expect(page.getByText(NUMBER_MESSAGE)).toHaveCount(2);
    await expect(page.getByLabel(LABEL_USD)).toBeFocused();
    await expect(page.getByLabel(LABEL_USD)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel(LABEL_EUR)).toHaveValue('88.371');
    // The message clears when its field is edited.
    await page.getByLabel(LABEL_USD).fill('-1');
    await expect(page.getByText(NUMBER_MESSAGE)).toHaveCount(1);
    await page.getByRole('button', { name: 'Save exchange rates' }).click();
    await expect(page.getByText(NUMBER_MESSAGE)).toHaveCount(2);
    await page.getByLabel(LABEL_USD).fill('abc');
    await page.getByLabel(LABEL_EUR).fill('88.37');
    await page.getByRole('button', { name: 'Save exchange rates' }).click();
    await expect(page.getByText(NUMBER_MESSAGE)).toHaveCount(1);
    expect(sent).toEqual([]);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-3, AC-7 (QLT-01): after a refusal of both fields, typing a fix into the first keeps focus and the text there, and writes nothing into the second', async ({ page }) => {
    await answerGetWith(page, STORED);
    const sent = recordPuts(page);
    await openWithForm(page);
    await page.getByLabel(LABEL_USD).fill('');
    await page.getByLabel(LABEL_EUR).fill('88.371');
    await page.getByRole('button', { name: 'Save exchange rates' }).click();
    await expect(page.getByText(NUMBER_MESSAGE)).toHaveCount(2);
    await expect(page.getByLabel(LABEL_USD)).toBeFocused();

    // The keys go to whatever has focus, as a keyboard user's do. The first key clears the message under USD; focus must not move to EUR for it.
    await page.keyboard.type('84.37');
    await expect(page.getByLabel(LABEL_USD)).toBeFocused();
    await expect(page.getByLabel(LABEL_USD)).toHaveValue('84.37');
    await expect(page.getByLabel(LABEL_EUR)).toHaveValue('88.371');
    // Only the message under EUR is left, and nothing was sent.
    await expect(page.getByText(NUMBER_MESSAGE)).toHaveCount(1);
    expect(sent).toEqual([]);
  });

  test('AC-3, AC-7 (QLT-01, mirror): after a refusal of both fields, Tab to the second and typing a fix keeps focus and the text there', async ({ page }) => {
    await answerGetWith(page, STORED);
    await openWithForm(page);
    await page.getByLabel(LABEL_USD).fill('');
    await page.getByLabel(LABEL_EUR).fill('88.371');
    await page.getByRole('button', { name: 'Save exchange rates' }).click();
    await expect(page.getByText(NUMBER_MESSAGE)).toHaveCount(2);
    await expect(page.getByLabel(LABEL_USD)).toBeFocused();

    // The person goes on to the second field. Clearing its message must not send focus back to the first field, which still has one.
    await page.keyboard.press('Tab');
    await expect(page.getByLabel(LABEL_EUR)).toBeFocused();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('88.37');
    await expect(page.getByLabel(LABEL_EUR)).toBeFocused();
    await expect(page.getByLabel(LABEL_EUR)).toHaveValue('88.37');
    await expect(page.getByLabel(LABEL_USD)).toHaveValue('');
    await expect(page.getByText(NUMBER_MESSAGE)).toHaveCount(1);
  });

  test('AC-3, AC-7 (QLT-01, server): after the server refuses both fields, typing a fix into the first keeps focus and the text there', async ({ page }) => {
    await answerGetWith(page, STORED);
    await page.route('**/api/v1/exchange-rates', (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({
            status: 422,
            contentType: 'application/problem+json',
            body: JSON.stringify({
              type: 'about:blank',
              title: 'Invalid',
              status: 422,
              code: 'VALIDATION_FAILED',
              requestId: 'req-0a0b0c0d',
              errors: [
                { field: 'usd', message: NUMBER_MESSAGE },
                { field: 'eur', message: NUMBER_MESSAGE },
              ],
            }),
          })
        : route.fallback(),
    );
    await openWithForm(page);
    await page.getByLabel(LABEL_USD).fill('99.37');
    await page.getByLabel(LABEL_EUR).fill('98.73');
    await page.getByRole('button', { name: 'Save exchange rates' }).click();
    await expect(page.getByText(NUMBER_MESSAGE)).toHaveCount(2);
    await expect(page.getByLabel(LABEL_USD)).toBeFocused();

    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('84.37');
    await expect(page.getByLabel(LABEL_USD)).toBeFocused();
    await expect(page.getByLabel(LABEL_USD)).toHaveValue('84.37');
    await expect(page.getByLabel(LABEL_EUR)).toHaveValue('98.73');
    await expect(page.getByText(NUMBER_MESSAGE)).toHaveCount(1);
  });

  test('AC-3: the real server refuses a bad value with 422 naming the field, and the screen shows its message under that field', async ({ page, request }) => {
    const refused = await request.put(API, { headers: JSON_HEADERS, data: { usd: '81.37', eur: '88.371' } });
    expect(refused.status()).toBe(422);
    const body = z.object({ errors: z.array(z.object({ field: z.string(), message: z.string() })) }).parse(await refused.json());
    expect(body.errors).toEqual([{ field: 'eur', message: NUMBER_MESSAGE }]);
    expect((await request.put(API, { headers: JSON_HEADERS, data: { usd: '', eur: '88.37' } })).status()).toBe(422);
    expect((await request.put(API, { headers: JSON_HEADERS, data: { usd: '-1', eur: '88.37' } })).status()).toBe(422);

    // The screen puts a refusal that came from the server under the field it names, and takes focus there.
    await answerGetWith(page, STORED);
    await page.route('**/api/v1/exchange-rates', (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({
            status: 422,
            contentType: 'application/problem+json',
            body: JSON.stringify({ type: 'about:blank', title: 'Invalid', status: 422, code: 'VALIDATION_FAILED', requestId: 'req-0a0b0c0d', errors: [{ field: 'eur', message: NUMBER_MESSAGE }] }),
          })
        : route.fallback(),
    );
    await openWithForm(page);
    await page.getByLabel(LABEL_EUR).fill('99.37');
    await page.getByRole('button', { name: 'Save exchange rates' }).click();
    await expect(page.getByText(NUMBER_MESSAGE)).toHaveCount(1);
    await expect(page.getByLabel(LABEL_EUR)).toBeFocused();
    await expect(page.getByLabel(LABEL_EUR)).toHaveValue('99.37');
  });

  test('a save with the values that are already stored sends nothing and says so', async ({ page }) => {
    await answerGetWith(page, STORED);
    const sent = recordPuts(page);
    await openWithForm(page);
    await page.getByRole('button', { name: 'Save exchange rates' }).click();
    await expect(page.getByText(NOTHING_TO_SAVE_NOTICE)).toBeVisible();
    expect(sent).toEqual([]);
  });

  test('a save that fails says so in a notice at the top, and keeps the typed values', async ({ page }) => {
    await answerGetWith(page, STORED);
    await page.route('**/api/v1/exchange-rates', (route) => (route.request().method() === 'PUT' ? route.fulfill(BUSY) : route.fallback()));
    await openWithForm(page);
    await page.getByLabel(LABEL_USD).fill('99.37');
    await page.getByRole('button', { name: 'Save exchange rates' }).click();
    await expect(page.getByText('We could not save the exchange rates.')).toBeVisible();
    await expect(page.getByText(FAILED_SAVE_BODY)).toBeVisible();
    await expect(page.getByText('Nothing was changed.')).toHaveCount(0);
    await expect(page.getByLabel(LABEL_USD)).toHaveValue('99.37');
  });
});

test.describe('loading and the load error (AC-7)', () => {
  test('a slow read shows the skeleton with a polite "Loading the exchange rates" and then the form', async ({ page }) => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/v1/exchange-rates', async (route: Route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await gate;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STORED) });
    });
    await openExchangeRates(page);
    await expect(page.getByRole('status').filter({ hasText: 'Loading the exchange rates' })).toBeAttached();
    await expect(page.getByLabel(LABEL_USD)).toHaveCount(0);
    release();
    await expect(page.getByLabel(LABEL_USD)).toHaveValue('81.37');
  });

  test('when the first read fails, "We could not load the exchange rates" takes focus, and Try again reads it and brings the form', async ({ page }) => {
    let fail = true;
    await page.route('**/api/v1/exchange-rates', (route) => (route.request().method() === 'GET' && fail ? route.fulfill(BUSY) : route.continue()));
    await openExchangeRates(page);
    const title = page.getByRole('heading', { name: LOAD_ERROR_TITLE });
    await expect(title).toBeVisible();
    await expect(title).toBeFocused();
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByLabel(LABEL_USD)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save exchange rates' })).toBeFocused();
  });

  test('DEF-020: when a save succeeds and the read after it fails, focus is on the error title, not on the page heading, and stays there; Try again brings the form back with focus on Save', async ({ page }) => {
    const values = CANARY_PAIR;
    let putDone = false;
    await page.route('**/api/v1/exchange-rates', (route) => {
      const method = route.request().method();
      if (method === 'PUT') {
        putDone = true;
        return route.continue();
      }
      if (method !== 'GET') return route.continue();
      return putDone ? route.fulfill(BUSY) : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STORED) });
    });
    await openWithForm(page);
    await page.getByLabel(LABEL_USD).fill(values.usd);
    await page.getByLabel(LABEL_EUR).fill(values.eur);
    const focusLog = await recordFocus(page);
    await page.getByRole('button', { name: 'Save exchange rates' }).click();

    const title = page.getByRole('heading', { name: LOAD_ERROR_TITLE });
    await expect(title).toBeVisible();
    await afterOneFrame(page);
    // The error title took focus, and nothing took it away: the page heading never had it (DEF-020), and it is still on the title now.
    expect(focusLog).toContain(`H2:${LOAD_ERROR_TITLE}`);
    expect(focusLog.filter((entry) => entry.startsWith('H1:'))).toEqual([]);
    expect(focusLog.at(-1)).toBe(`H2:${LOAD_ERROR_TITLE}`);
    await expect(title).toBeFocused();
    // Polled at the three widths of the projects (360, 768 and 1366 px): the element with focus is the title, and stays it.
    await expect.poll(() => page.evaluate(() => document.activeElement?.textContent ?? ''), { message: 'focus stays on the error title' }).toBe(LOAD_ERROR_TITLE);
    // The save did succeed, and the notice says so beside the error, whose sentence does not say that nothing was changed.
    await expect(page.getByRole('status').filter({ hasText: SAVED_NOTICE })).toBeVisible();
    await expect(page.getByText(SAVED_BUT_NOT_SHOWN_BODY)).toBeVisible();
    await expect(page.getByText('Nothing was changed.')).toHaveCount(0);

    putDone = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByLabel(LABEL_USD)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save exchange rates' })).toBeFocused();
  });
});
