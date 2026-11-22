import { expect, test, type Locator, type Page, type Response } from '@playwright/test';

import { canaryTaskCodeFor } from '../support/estimate-recipe';
import { createDisposableUser, E2E_ADMIN, E2E_PASSWORD, putPictureOnCanaryPart, readEstimateState, useFreshAddress } from '../e2e/support/auth';
import { calculateWithoutThePage, engineerWithEstimate, makeCalculable, signInAs, signInAsLead } from '../e2e/support/calculated-estimate';
import { waitUntilHydrated } from '../e2e/support/design-system';
import { withExportTurn } from '../e2e/support/export-slot';
import { makeRate, openProcessMaster, rowButton } from '../e2e/support/masters';
import { control, nextSave, openForm, partForm, waitForForm } from '../e2e/support/part-form';

import { expectClearOfBar, expectFocusVisible, pressUntilFocused } from './support/keyboard';

/**
 * STORY-10.08 AC-4 (NFR-018; UX-14): the five key flows by keyboard alone. No mouse input anywhere: the keys are `page.keyboard` (Tab, Shift+Tab, Enter, Space, Escape, and Ctrl+A to
 * replace a typed value), and a page is reached with `goto`, which is an address typed in the bar and not a pointer. At every step the focus is checked to be visible
 * (`expectFocusVisible`), and on the estimate form and review the focused control must be clear of the sticky action bar. The flows, in the order of the story:
 *   1. an Engineer signs in, opens the queue and opens a task;
 *   2. an Engineer goes through the form with Enter between fields, presses Calculate, goes back on the quantity warning, fixes the count and calculates;
 *   3. a Lead opens a calculated estimate, reads its cost details and approves it;
 *   4. the Admin edits a Process Master rate and saves;
 *   5. a Lead downloads the Excel file.
 * The story says flow 3 approves "with the password step". Approve and lock has no password step in the product (its dialog holds the price and an optional reason; only Cancel approval
 * and the formula save ask for the password), so the flow approves with the dialog the product has. The 360 project also runs flow 2 with the window at 320 wide, where the action bar wraps.
 * Every person is invented; each flow makes its own and signs in on a client address of its own.
 */

test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

/**
 * Every field a person types into, in the order of the form (`estimate-form-sections.spec.ts` holds the same list), plus the box for the words of "Other" that Treatment / Color (G) shows once
 * "Other" is chosen. The part of this flow holds "Other" (`completePartInputsFor`), and Enter goes through the box before it reaches H; `estimate-form-sections.spec.ts` opens a blank part, which has no box.
 */
const FORM_ORDER = ['B', 'D', 'G', 'G-other', 'H', 'E', 'J', 'K', 'L', 'N', 'P', 'Q', 'R', 'S', 'V', 'W', 'X', 'Y', 'AP', 'AU', 'BM', 'AJ'] as const;
const FILE_NAME = /^[^\s/\\:*?"<>|]+_\d{2}-\d{2}-\d{4}\.xlsx$/u;
const REFLOW_WIDTH = 320;
const REFLOW_HEIGHT = 640;
const NARROW_MAX = 360;
const FLOW_TIMEOUT = 150_000;

/** A field of FORM_ORDER: its control, or for `G-other` the box of the words of "Other" (the form's only control whose ID ends in `-other`). */
const fieldOf = (page: Page, key: (typeof FORM_ORDER)[number]): Locator => (key === 'G-other' ? partForm(page).locator('[id^="part-field-"][id$="-other"]') : control(page, key));
const calculateButton = (page: Page): Locator => page.locator('#calculate-button');
const bar = (page: Page): Locator => page.locator('[data-calculate-bar]');
const isCalculate = (response: Response): boolean => response.request().method() === 'POST' && /\/api\/v1\/estimates\/[^/]+\/calculate$/.test(new URL(response.url()).pathname);

/** The page puts a focused field clear of the bar with a scroll padding that it publishes after it has measured the bar; a Tab before that scrolls a field behind it (the wait of `estimate-calculate.spec.ts`). */
async function waitForBarOffset(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--sticky-bottom') !== '');
}

/** Presses Enter through the fields after `from` (a letter of FORM_ORDER, already focused), checking each one, then once more to land on Calculate. Enter on the last field moves to Calculate and does not press it. */
async function enterThrough(page: Page, from: (typeof FORM_ORDER)[number]): Promise<void> {
  for (const next of FORM_ORDER.slice(FORM_ORDER.indexOf(from) + 1)) {
    await page.keyboard.press('Enter');
    await expect(fieldOf(page, next), `Enter should reach ${next}`).toBeFocused();
    await expectFocusVisible(page, `on field ${next}`);
    await expectClearOfBar(page, bar(page), `on field ${next} at ${page.viewportSize()?.width ?? 0} px`);
  }
  await page.keyboard.press('Enter');
  await expect(calculateButton(page), 'Enter on the last field reaches Calculate').toBeFocused();
  await expectFocusVisible(page, 'on Calculate');
}

/** Types a count into QTY per Assy (H) by keyboard, from a field that has focus: back to H with Shift+Tab, replace the value, and leave it with Enter so it is saved. Returns with focus on the field after H. */
async function typeQuantity(page: Page, value: string): Promise<void> {
  await pressUntilFocused(page, 'Shift+Tab', control(page, 'H'), 'QTY per Assy');
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(value);
  const saved = nextSave(page);
  await page.keyboard.press('Enter');
  expect(await saved, `the count ${value} is saved when the field is left`).toBe(200);
  await expect(control(page, 'E')).toBeFocused();
}

/** Opens the form of an Engineer whose part is complete, with the window at the project's width. */
async function openCompleteForm(page: Page, testInfo: Parameters<typeof openForm>[1]): Promise<{ readonly id: string }> {
  const owner = await openForm(page, testInfo);
  await makeCalculable(owner);
  await page.reload();
  await waitForForm(page);
  await waitForBarOffset(page);
  return owner;
}

test.describe('AC-4: five flows by keyboard alone', () => {
  test.setTimeout(FLOW_TIMEOUT);

  test('(1) an Engineer signs in, opens the queue and opens a task', async ({ page }, testInfo) => {
    const owner = await createDisposableUser('scan', testInfo);
    const code = canaryTaskCodeFor(owner.id);

    await page.goto('/sign-in');
    await waitUntilHydrated(page, 'form[aria-label="Sign in"]', 'onSubmit');
    await pressUntilFocused(page, 'Tab', page.getByLabel('E-mail'), 'the e-mail field');
    await page.keyboard.type(owner.email);
    await pressUntilFocused(page, 'Tab', page.getByLabel('Password', { exact: true }), 'the password field');
    await page.keyboard.type(E2E_PASSWORD);
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/queue$/);
    await expect(page.getByRole('heading', { level: 1, name: 'My tasks' })).toBeVisible();
    const task = page.getByRole('main').getByRole('link', { name: code, exact: true }).first();
    await expect(task).toBeVisible();
    await pressUntilFocused(page, 'Tab', task, `the task ${code}`);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/estimates/${code}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(code);
  });

  test('(2) an Engineer goes through the form with Enter, presses Calculate, goes back on the quantity warning, fixes the count and calculates', async ({ page }, testInfo) => {
    const owner = await openCompleteForm(page, testInfo);
    await pressUntilFocused(page, 'Tab', control(page, 'B'), 'Part No.');
    await enterThrough(page, 'B');

    // UX-14: at 360 px every field is clear of the bar, and also with the window at 320 px, where the bar's buttons wrap and the bar is taller.
    if ((page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) <= NARROW_MAX) {
      await page.setViewportSize({ width: REFLOW_WIDTH, height: REFLOW_HEIGHT });
      await page.reload();
      await waitForForm(page);
      await waitForBarOffset(page);
      await pressUntilFocused(page, 'Tab', control(page, 'B'), 'Part No. at 320 px');
      await enterThrough(page, 'B');
    }

    // A count of 0 is the quantity warning: the first press of Calculate asks, and "Go back" changes nothing.
    await typeQuantity(page, '0');
    await enterThrough(page, 'E');
    const asked = page.waitForResponse(isCalculate);
    await page.keyboard.press('Enter');
    expect((await asked).status(), 'the first press is asked about the 0').toBe(409);
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    const goBack = dialog.getByRole('button', { name: 'Go back', exact: true });
    await expect(goBack, 'focus starts on the safe choice').toBeFocused();
    await expectFocusVisible(page, 'on Go back');
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(calculateButton(page), 'focus goes back to Calculate').toBeFocused();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'DRAFT', calculations: 0 });

    // The count is fixed, and Calculate goes through.
    await typeQuantity(page, '7');
    await enterThrough(page, 'E');
    const answered = page.waitForResponse(isCalculate);
    await page.keyboard.press('Enter');
    expect((await answered).status(), 'the Calculate of the Engineer').toBe(200);
    await expect(calculateButton(page)).toHaveText('Submitted');
    expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });
    await expect(partForm(page)).toBeVisible();
  });

  test('(3) a Lead opens a calculated estimate, reads its cost details and approves it', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateWithoutThePage(page, owner);
    await signInAsLead(page, testInfo);
    await page.goto(`/estimates/${code}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(code);
    const approve = page.locator('#review-approve');
    await expect(approve).toBeEnabled();
    await waitUntilHydrated(page, '#review-approve');
    const actions = page.getByRole('group', { name: 'Actions' });

    // The cost details of the first row: Tab to its link, Enter.
    const details = page.getByRole('link', { name: /^View cost details/ }).first();
    await pressUntilFocused(page, 'Tab', details, 'View cost details');
    await expectClearOfBar(page, actions, 'on View cost details');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/estimates/${code}/costs/1$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cost details');

    // Read a stage: Tab to the heading of the Pricing stage and press Enter, which toggles it.
    const stage = page.locator('details[data-stage="6"]');
    const summary = stage.locator('summary');
    await pressUntilFocused(page, 'Tab', summary, 'the Pricing stage');
    const wasOpen = await stage.evaluate((element) => element instanceof HTMLDetailsElement && element.open);
    await page.keyboard.press('Enter');
    await expect.poll(() => stage.evaluate((element) => element instanceof HTMLDetailsElement && element.open), { message: 'Enter toggles the stage' }).toBe(!wasOpen);

    // Back to the estimate, then Approve and lock: the dialog opens on the price, and Enter in it approves.
    await pressUntilFocused(page, 'Tab', page.getByRole('link', { name: 'Back to the estimate' }), 'Back to the estimate');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/estimates/${code}$`));
    await expect(approve).toBeEnabled();
    await waitUntilHydrated(page, '#review-approve');
    await pressUntilFocused(page, 'Tab', approve, 'Approve and lock');
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Approve and lock' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#approve-price'), 'focus starts on the price').toBeFocused();
    await expectFocusVisible(page, 'on the price');
    await page.keyboard.press('Enter');
    await expect(page.locator('#review-approved-notice')).toBeVisible();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'APPROVED', calculations: 1 });
  });

  test('(4) the Admin edits a Process Master rate and saves', async ({ page }, testInfo) => {
    await signInAs(page, E2E_ADMIN);
    const name = await makeRate(page, testInfo);
    await openProcessMaster(page);

    const edit = rowButton(page, name, 'Edit').first();
    await pressUntilFocused(page, 'Tab', edit, `Edit ${name}`);
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
    await expect(dialog).toBeVisible();

    await pressUntilFocused(page, 'Tab', dialog.getByLabel('Default value'), 'Default value');
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('5.37');
    await pressUntilFocused(page, 'Tab', dialog.getByRole('button', { name: 'Save' }), 'Save');
    const saved = page.waitForResponse((response) => response.request().method() === 'PATCH' && new URL(response.url()).pathname.startsWith('/api/v1/process-items/'));
    await page.keyboard.press('Enter');
    expect((await saved).status(), 'the save of the rate').toBe(200);
    await expect(dialog).toBeHidden();
    await expect(page.locator('[data-item-id]:visible').filter({ hasText: name }).first()).toContainText('5.37');
  });

  test('(5) a Lead downloads the Excel file', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await putPictureOnCanaryPart(owner.id);
    await calculateWithoutThePage(page, owner);
    await signInAsLead(page, testInfo);
    await page.goto(`/estimates/${code}/export`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Excel export');
    const download = page.getByRole('button', { name: 'Download .xlsx' });
    await expect(download).toBeEnabled();
    // A press before the page has its scripts is lost (DEF-011), so the wait is for the button's handler.
    await waitUntilHydrated(page, '#export-download');
    await pressUntilFocused(page, 'Tab', download, 'Download .xlsx');
    const [file] = await withExportTurn(() => Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]));
    expect(file.suggestedFilename()).toMatch(FILE_NAME);
    expect(file.suggestedFilename()).toContain('_Canary-subject_');
  });
});
