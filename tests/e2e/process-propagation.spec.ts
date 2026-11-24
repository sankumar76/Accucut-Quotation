import { randomBytes } from 'node:crypto';

import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { expectNoAxeViolations, horizontalOverflow, TABLET_MIN_WIDTH } from './support/design-system';
import { openProcessMaster, pressWithKeyboard, rowButton } from './support/masters';
import { shortNameOf } from '../support/customer-short-name';
import { ADMIN_STATE, DEVELOPMENT_URL } from './support/servers';
import { JSON_HEADERS } from './support/treatments';

/**
 * STORY-02.08 T7 (AC-1 to AC-3, AC-5, AC-10): the dialog "Customers differ" of SCR-11 at 360x800, 768x1024 and 1366x768 on the development server, signed in as the
 * E2E Admin. One test per screen size (the dialog is worth one page open and one axe scan, test plan section 7): a rate with three customers (one on its default, two
 * with a value of their own) is saved at a new default; the window asks about the two, by keyboard alone: focus lands on its title, every row starts on Keep, the arrow
 * keys and the two "all" buttons move the radios, Save choices applies only what was chosen and the notice says the counts; a second change of the default then closes
 * the window with Escape, which keeps every customer's value and says so. The values are read back through the customers' API, so the screen is not the only witness.
 *
 * The rate and the customers are the test's own (an invented name with the screen size, the repeat, the retry and a random part), made and removed through the API, so the
 * three screen sizes and the retries never meet on one rate. Other specs' customers also follow the new rate (they hold its default), which is why the number of customers
 * that move by themselves is read with a pattern and not written out. The words are the story's proposal (OQ-1), written out here. Names and numbers are invented (`n.37`, ADR-014).
 */

test.use({ storageState: ADMIN_STATE });

// AQP-423 (DEF-080) step lines: one line per step, printed as the step ends, so a CI log shows where the seconds go. Kept until DEF-080 closes.
const STEP_TIMING = '[AQP-423 step timing]';
const startedAt = new Map<string, number>();
const lastLap = new Map<string, number>();
function lap(label: string): void {
  const info = test.info();
  const now = Date.now();
  const begin = startedAt.get(info.testId) ?? now;
  const before = lastLap.get(info.testId) ?? begin;
  startedAt.set(info.testId, begin);
  lastLap.set(info.testId, now);
  process.stdout.write(`${STEP_TIMING} ${info.project.name} | attempt ${String(info.retry + 1)} | ${label} | ${String(now - before)} ms | at +${String(now - begin)} ms\n`);
}
/** Passive: one line for each request the page itself makes to the API or asks for a page, with the time it took, so a slow step can be told from a slow answer. */
function watchRequests(page: Page): void {
  page.on('requestfinished', (request) => {
    const kind = request.resourceType();
    if (kind !== 'fetch' && kind !== 'xhr' && kind !== 'document') return;
    const { startTime, responseEnd } = request.timing();
    const took = responseEnd < 0 ? 'unknown' : `${String(Math.round(responseEnd - startTime))} ms`;
    void request.response().then((response) => {
      const info = test.info();
      const at = Date.now() - (startedAt.get(info.testId) ?? Date.now());
      process.stdout.write(`${STEP_TIMING} ${info.project.name} | attempt ${String(info.retry + 1)} | page request ${request.method()} ${new URL(request.url()).pathname} -> ${String(response?.status() ?? 'none')} | ${took} | ended at +${String(at)} ms
`);
    });
  });
}
test.beforeEach(() => {
  const info = test.info();
  startedAt.set(info.testId, Date.now());
  lastLap.set(info.testId, Date.now());
});
test.afterEach(() => {
  lap(`end (${test.info().status ?? 'unknown'})`);
});

const RATES_API = `${DEVELOPMENT_URL}/api/v1/process-items`;
const CUSTOMERS_API = `${DEVELOPMENT_URL}/api/v1/customers`;
const FIRST_DEFAULT = '1.37';
const SECOND_DEFAULT = '1.52';
const THIRD_DEFAULT = '1.60';
const BRAVO_OWN = '1.50';
const CHARLIE_OWN = '1.45';
const NO_CONTENT = 204;
const CREATED = 201;
/** The column of the table that says how many customers hold their own value: the fifth cell of a row (rate, unit, default, used in, this). */
const OWN_VALUE_CELL = 4;

interface Customer {
  readonly id: string;
  readonly name: string;
}

interface World {
  readonly rateId: string;
  readonly name: string;
  readonly alpha: Customer;
  readonly bravo: Customer;
  readonly charlie: Customer;
}

const tagOf = (testInfo: TestInfo): string => `${testInfo.project.name}-r${testInfo.repeatEachIndex}-t${testInfo.retry}-${randomBytes(3).toString('hex')}`;

async function post(page: Page, url: string, data: unknown): Promise<string> {
  const response = await page.request.post(url, { headers: JSON_HEADERS, data });
  lap(`POST ${url.replace(DEVELOPMENT_URL, '')} -> ${String(response.status())}`);
  expect(response.status()).toBe(CREATED);
  return ((await response.json()) as { id: string }).id;
}

async function makeCustomer(page: Page, name: string): Promise<Customer> {
  return { id: await post(page, CUSTOMERS_API, { name, shortName: shortNameOf(name) }), name };
}

/** A rate at 1.37, and three customers: alpha on its default, bravo at 1.50 and charlie at 1.45. Named so that the window lists bravo before charlie. */
async function makeWorld(page: Page, testInfo: TestInfo): Promise<World> {
  const tag = tagOf(testInfo);
  const name = `E2E-propagation-rate-${tag}`;
  // The rate and the three customers do not depend on each other, and the two values of their own only on the rate and on bravo and charlie: two rounds of requests sent together (DEF-080).
  const [rateId, alpha, bravo, charlie] = await Promise.all([
    post(page, RATES_API, { name, unit: 'per kg', defaultValue: FIRST_DEFAULT }),
    makeCustomer(page, `E2E Alpha ${tag}`),
    makeCustomer(page, `E2E Bravo ${tag}`),
    makeCustomer(page, `E2E Charlie ${tag}`),
  ]);
  lap('rate and three customers made');
  const responses = await Promise.all(
    ([[bravo, BRAVO_OWN], [charlie, CHARLIE_OWN]] as const).map(([customer, value]) =>
      page.request.patch(`${CUSTOMERS_API}/${customer.id}`, { headers: JSON_HEADERS, data: { rates: [{ processItemId: rateId, value }] } }),
    ),
  );
  lap('two own values set');
  for (const response of responses) expect(response.ok()).toBe(true);
  return { rateId, name, alpha, bravo, charlie };
}

/**
 * The customer's value for the rate, as a number. There is no route that reads one customer, so this saves its own name (no change, so no entry and no write)
 * and reads the customer the answer carries.
 */
async function valueOf(page: Page, world: World, customer: Customer): Promise<number> {
  const response = await page.request.patch(`${CUSTOMERS_API}/${customer.id}`, { headers: JSON_HEADERS, data: { name: customer.name } });
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { rates: ReadonlyArray<{ processItemId: string; value: string }> };
  return Number(body.rates.find((rate) => rate.processItemId === world.rateId)?.value);
}

/** The values of several customers, read together: each read is its own request and none depends on another (DEF-080). */
async function valuesOf(page: Page, world: World, customers: readonly Customer[]): Promise<number[]> {
  const values = await Promise.all(customers.map((customer) => valueOf(page, world, customer)));
  lap(`${String(customers.length)} value(s) read`);
  return values;
}

async function cleanUp(page: Page, world: World): Promise<void> {
  lap('cleanUp starts');
  // The three customers go together, and the rate after them, as before (the order of customers then rate is kept).
  await Promise.all([world.alpha, world.bravo, world.charlie].map((customer) => page.request.delete(`${CUSTOMERS_API}/${customer.id}`, { headers: JSON_HEADERS })));
  lap('cleanUp: three customers removed');
  const gone = await page.request.delete(`${RATES_API}/${world.rateId}`, { headers: JSON_HEADERS });
  lap(`cleanUp DELETE rate -> ${String(gone.status())}`);
  expect([NO_CONTENT, 404]).toContain(gone.status());
}

/** Edits the rate's default through the dialog, by keyboard, and presses Save. */
async function saveDefault(page: Page, world: World, value: string): Promise<void> {
  await pressWithKeyboard(rowButton(page, world.name, 'Edit'));
  const form = page.getByRole('dialog', { name: `Edit ${world.name}` });
  await form.getByLabel('Default value').fill(value);
  lap('saveDefault: dialog open, filled');
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(form).toBeHidden();
  lap('saveDefault: Save pressed, dialog hidden');
}

/** The two radios of one customer's fieldset. */
function choicesOf(window: Locator, customer: Customer): { apply: Locator; keep: Locator } {
  const group = window.getByRole('radiogroup', { name: customer.name });
  return { apply: group.getByRole('radio', { name: /^Apply / }), keep: group.getByRole('radio', { name: /^Keep / }) };
}

test.describe('a changed default reaches the customers (AC-1 to AC-3, AC-5, AC-10)', () => {
  test('moves the customers on the old default, asks about the others by keyboard, saves only what was chosen, and Escape keeps every value', async ({ page }, testInfo) => {
    const world = await makeWorld(page, testInfo);
    try {
      lap('world made');
      watchRequests(page);
      await openProcessMaster(page);
      lap('Process Master opened');
      await saveDefault(page, world, SECOND_DEFAULT);

      const window = page.getByRole('dialog', { name: `${world.name} changed from ${FIRST_DEFAULT} to ${SECOND_DEFAULT}` });
      await expect(window).toBeVisible();
      lap('window visible');
      await expect(window.getByRole('heading', { level: 2 })).toBeFocused();
      await expect(window).toContainText(new RegExp(`customers? ha(?:d|s|ve) ${FIRST_DEFAULT} and now ha(?:s|ve) ${SECOND_DEFAULT}\\. 2 customers have a different value\\. Choose what to do for each one\\.`));
      lap('window text checked');
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      lap('overflow read');
      await expectNoAxeViolations(page);
      lap('axe scan');

      // Every row starts on Keep, and only the two customers with a value of their own are asked about (alpha moved by itself).
      const bravo = choicesOf(window, world.bravo);
      const charlie = choicesOf(window, world.charlie);
      await expect(window.getByRole('radiogroup')).toHaveCount(2);
      await expect(bravo.keep).toBeChecked();
      await expect(charlie.keep).toBeChecked();
      await expect(bravo.keep).toHaveAccessibleName(`Keep ${BRAVO_OWN}`);
      await expect(bravo.apply).toHaveAccessibleName(`Apply ${SECOND_DEFAULT}`);

      // Tab reaches the close icon and then the first customer's chosen radio; the arrow keys move the choice; the two "all" buttons set every radio and save nothing.
      lap('radios checked');
      await page.keyboard.press('Tab');
      await expect(window.getByRole('button', { name: 'Close' })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(bravo.keep).toBeFocused();
      // Radix moves focus a task after the key goes down and checks the radio only if the key is still down when focus arrives, as it is for a person: a press that is over in one tick would miss it.
      await page.keyboard.down('ArrowLeft');
      await expect(bravo.apply).toBeFocused();
      await page.keyboard.up('ArrowLeft');
      await expect(bravo.apply).toBeChecked();
      lap('arrow key moved the radio');
      await window.getByRole('button', { name: 'Apply to all 2' }).click();
      await expect(charlie.apply).toBeChecked();
      await window.getByRole('button', { name: 'Keep all 2' }).click();
      await expect(bravo.keep).toBeChecked();
      await expect(charlie.keep).toBeChecked();
      lap('all-buttons done');
      expect(await valuesOf(page, world, [world.bravo, world.charlie])).toEqual([Number(BRAVO_OWN), Number(CHARLIE_OWN)]);
      lap('values read, nothing saved');

      // Apply for bravo only, then Save choices by keyboard.
      await bravo.apply.focus();
      await page.keyboard.press('Space');
      await expect(bravo.apply).toBeChecked();
      await expect(charlie.keep).toBeChecked();
      await window.getByRole('button', { name: 'Save choices' }).focus();
      await page.keyboard.press('Enter');
      await expect(window).toBeHidden();
      lap('Save choices: window hidden');
      await expect(page.getByRole('status').filter({ hasText: '1 customer now has 1.52. 1 customer kept its own value. The changes are in the audit log.' })).toBeVisible();
      await expect(rowButton(page, world.name, 'Edit')).toBeFocused();
      lap('notice and focus checked');
      expect(await valuesOf(page, world, [world.alpha, world.bravo, world.charlie])).toEqual([1.52, 1.52, 1.45]);
      lap('three values read');
      if ((page.viewportSize()?.width ?? 0) >= TABLET_MIN_WIDTH) {
        await expect(page.locator('[data-item-id]:visible').filter({ hasText: world.name }).getByRole('cell').nth(OWN_VALUE_CELL)).toHaveText('1');
      }

      // A second change, and Escape: the same as Keep all, nothing is sent, and the notice says so.
      lap('own-value column checked');
      await saveDefault(page, world, THIRD_DEFAULT);
      const second = page.getByRole('dialog', { name: `${world.name} changed from ${SECOND_DEFAULT} to ${THIRD_DEFAULT}` });
      await expect(second).toBeVisible();
      await expect(second).toContainText('1 customer has a different value. Choose what to do for it.');
      await expect(second.getByRole('button', { name: 'Keep it' })).toBeVisible();
      lap('second window checked');
      await page.keyboard.press('Escape');
      await expect(second).toBeHidden();
      await expect(page.getByRole('status').filter({ hasText: "1 customer kept its own value. Its rate changes only when you edit it on the customer's page." })).toBeVisible();
      await expect(rowButton(page, world.name, 'Edit')).toBeFocused();
      expect(await valueOf(page, world, world.charlie)).toBe(Number(CHARLIE_OWN));
      lap('last value read');
    } finally {
      await cleanUp(page, world);
    }
  });
});
