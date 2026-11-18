import { expect, test, type Locator, type Page } from '@playwright/test';

import { FIELD_ID_NAMESPACE, seedId } from '../../prisma/seed/config/seed-sections-and-stages';
import { columnLetterToIndex } from '../../src/lib/columns';

import { E2E_PASSWORD } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE, SIGNED_IN_STATE } from './support/servers';

/**
 * STORY-08.02 (AC-1 to AC-7, AC-9, AC-10; FR-022, FR-023, FR-073, FR-080; NFR-016 to NFR-018): SCR-18 "Formula editor" at 360x800, 768x1024 and 1366x768 on the development server, as the E2E Admin and the E2E
 * Lead (the saved browser states of the set-up project, so no test spends its 30 s on a sign-in). The words are the UX spec's and the story's, written out here and not imported.
 *
 * What is checked: the editor opens from SCR-17 for the Admin and from no row for the Lead; the monospace box shows the saved formula, the live region says it is valid and what it uses and feeds, and Save
 * is off until the formula changed and is valid; an unknown name, a syntax error and a loop show their sentence and keep Save off; the suggestion list works by keyboard alone (arrows, Enter, Escape);
 * the password step opens, refuses a wrong password in its own words and keeps the formula, and closes with Cancel; the preview shows the result on a sample row, or says there is no calculated estimate;
 * no sideways scroll, controls of 44 px, axe 0 violations. **One test saves**, in all three projects, on a field no other spec reads, with a formula that gives the same figures as the saved one; a second window opened before the save is refused with the 409 sentence. The sign-in is not the subject
 * here, so no test goes through its page (#459, #486). Every figure is the database's own.
 */

const AL_ID_PATTERN = /\/config\/fields\/[0-9a-f-]{36}\/formula$/;
const SAVED = 'P * Cutting-Rate-per-Sec';
const VALID_LINE = 'The formula is valid. It uses P (Cutting Time) and the rate Cutting-Rate-per-Sec. Column AL feeds AY.';
const UNKNOWN_LINE = '"Cuting-Rate-per-Sec" is not a column letter, rate name or function. Check the spelling, or add the rate in the Process master first.';
const SYNTAX_LINE = 'The formula ends too soon. A number or name is missing after "+" (position 29).';
const LOOP_LINE = 'This formula would make AL depend on itself. The loop is AL → AY → AL. Remove one of these references.';
const WRONG_LINE = 'That password is not correct. Try again.';

const box = (page: Page): Locator => page.getByRole('combobox', { name: /^Formula/ });
const saveButton = (page: Page): Locator => page.getByRole('button', { name: 'Save formula', exact: true });
const liveRegion = (page: Page): Locator => page.locator('#formula-check');

/** The editor of Cutting Cost (AL), reached the way an Admin reaches it: from "Edit formula" beside the field on SCR-17. */
/** The ID of a seed field, made from the seed's own rule (the same one the security tests' recipes use); the Playwright process cannot load the registry behind it. */
const fieldIdOf = (letter: string): string => seedId(FIELD_ID_NAMESPACE, columnLetterToIndex(letter));

/** The editor of a field by its address, for a test whose subject is not the way in (SCR-17 and its link are the first test's). */
async function openEditorDirectly(page: Page, letter: string): Promise<void> {
  await page.goto(`/config/fields/${fieldIdOf(letter)}/formula`);
  await expect(box(page)).toBeVisible();
  await waitUntilHydrated(page, '#formula-text', 'onChange');
}

async function openEditor(page: Page, letter = 'AL'): Promise<void> {
  await page.goto('/config/fields');
  const row = page.locator('[data-field-id]:visible').filter({ has: page.getByText(`Excel column ${letter}`, { exact: true }) });
  await expect(row).toBeVisible();
  await row.getByRole('link', { name: /^Edit formula/ }).click();
  await expect(page).toHaveURL(AL_ID_PATTERN);
  await expect(box(page)).toBeVisible();
  await waitUntilHydrated(page, '#formula-text', 'onChange');
}

/** Replaces the formula by typing, as a person does, and waits for the check of the new text (300 ms of pause and the answer). */
async function typeFormula(page: Page, text: string): Promise<void> {
  await box(page).fill(text);
}

test.describe('the Admin', () => {
  test.use({ storageState: ADMIN_STATE });

  test('AC-1, AC-3, AC-10: opens from SCR-17 with the saved formula, says it is valid in a polite live region, lists what uses the column, keeps Save off until it changes, no sideways scroll, axe 0', async ({ page }) => {
    await openEditor(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Edit formula: AL Cutting Cost' })).toBeVisible();
    await expect(box(page)).toHaveValue(SAVED);
    const region = liveRegion(page);
    await expect(region).toHaveAttribute('aria-live', 'polite');
    await expect(region).toContainText(VALID_LINE);
    await expect(page.getByRole('heading', { name: 'Used by' })).toBeVisible();
    await expect(page.getByText('Total Process Cost')).toBeVisible();
    await expect(saveButton(page)).toBeDisabled();
    await expect(page.getByText('Change the formula to save it.')).toBeVisible();
    expect((await saveButton(page).boundingBox() ?? { height: 0 }).height).toBeGreaterThanOrEqual(TOUCH_TARGET);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-2: an unknown name, a syntax error and a loop show the SCR-18 sentence in the live region, mark the box invalid and keep Save off', async ({ page }) => {
    await openEditor(page);
    for (const [text, line] of [
      ['P * Cuting-Rate-per-Sec', UNKNOWN_LINE],
      ['P * (Cutting-Rate-per-Sec + )', SYNTAX_LINE],
      ['P * Cutting-Rate-per-Sec + AY', LOOP_LINE],
    ] as const) {
      await typeFormula(page, text);
      await expect(liveRegion(page)).toContainText(line);
      await expect(box(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(saveButton(page)).toBeDisabled();
    }
    await expectNoAxeViolations(page);
    await typeFormula(page, 'P * Cutting-Rate-per-Sec * 2');
    await expect(liveRegion(page)).toContainText('The formula is valid.');
    await expect(box(page)).not.toHaveAttribute('aria-invalid', 'true');
    await expect(saveButton(page)).toBeEnabled();
  });

  test('AC-1, AC-10: the suggestions are used by keyboard alone: they list a rate by its start, Arrow Down moves, Enter puts it in the text, Escape closes the list', async ({ page }) => {
    await openEditor(page);
    const field = box(page);
    await field.fill('');
    await field.pressSequentially('P * Cutting-R');
    const list = page.getByRole('listbox', { name: 'Suggestions' });
    await expect(list).toBeVisible();
    await expect(field).toHaveAttribute('aria-expanded', 'true');
    await expect(list.getByRole('option', { name: /Cutting-Rate-per-Sec/ })).toBeVisible();
    await field.press('Escape');
    await expect(list).toBeHidden();
    await expect(field).toHaveAttribute('aria-expanded', 'false');
    await field.pressSequentially('a');
    await expect(list).toBeVisible();
    await field.press('ArrowDown');
    await field.press('ArrowUp');
    await field.press('Enter');
    await expect(field).toHaveValue(SAVED);
    await expect(list).toBeHidden();
    await expect(liveRegion(page)).toContainText(VALID_LINE);
    await expect(field).toBeFocused();
  });

  test('AC-4, AC-10: Save opens "Confirm with your password"; a wrong password is refused in its own words and the formula is kept; Cancel closes it with nothing saved', async ({ page }) => {
    await openEditor(page);
    await typeFormula(page, 'P * Cutting-Rate-per-Sec * 3');
    await expect(saveButton(page)).toBeEnabled();
    await saveButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'Confirm with your password' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Your password')).toBeFocused();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    await dialog.getByLabel('Your password').fill('Not-the-right-1!');
    await dialog.getByRole('button', { name: 'Save formula' }).click();
    await expect(dialog.getByText(WRONG_LINE)).toBeVisible();
    await expect(dialog.getByLabel('Your password')).toBeFocused();
    await expect(dialog.getByLabel('Your password')).toHaveValue('');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(box(page)).toHaveValue('P * Cutting-Rate-per-Sec * 3');
    await expect(page.getByText(/Formula saved as configuration version/)).toHaveCount(0);
  });

  test('AC-1, AC-8: the preview says there is no calculated estimate to try the formula on, and the check still works', async ({ page }) => {
    await page.route('**/api/v1/config/sample-rows', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ estimate: null, rows: [], operandNames: [] }) }),
    );
    await openEditor(page);
    await expect(page.getByText('There is no calculated estimate to try this on yet.')).toBeVisible();
    await expect(liveRegion(page)).toContainText('The formula is valid.');
    await expect(page.getByLabel('Try it on a sample row')).toHaveCount(0);
  });

  test('AC-1, AC-3, AC-8: the preview names the sample estimate, offers its rows, shows the result of the formula, and the dash for no figure', async ({ page }) => {
    await page.route('**/api/v1/config/sample-rows', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ estimate: { code: 'Q-2026-0318' }, rows: [{ id: '00000000-0000-4000-8000-0000000000a1', slNo: '1.1', name: 'Base frame' }], operandNames: [] }),
      }),
    );
    await page.route('**/api/v1/config/formula-check', async (route) => {
      const answer = (shown: string, value: string | null) => ({
        valid: true,
        message: VALID_LINE,
        uses: [],
        feeds: [{ letter: 'AY', label: 'Total Process Cost' }],
        note: null,
        preview: { estimateCode: 'Q-2026-0318', slNo: '1.1', value, shown, operands: [{ name: 'P Cutting Time', value: '96' }] },
      });
      const text = (route.request().postDataJSON() as { text: string }).text;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(text.includes('/ 0') ? answer('—', null) : answer('45.12', '45.12')) });
    });
    await openEditor(page);
    await expect(page.getByText('Sample rows come from the latest calculated estimate, Q-2026-0318. The preview changes nothing.')).toBeVisible();
    await expect(page.getByLabel('Try it on a sample row')).toHaveValue('00000000-0000-4000-8000-0000000000a1');
    await expect(page.getByRole('option', { name: '1.1 Base frame' })).toBeAttached();
    await expect(page.getByTestId('preview-result')).toHaveText('45.12');
    await typeFormula(page, 'P / 0');
    await expect(page.getByTestId('preview-result')).toHaveText('—');
  });

  test('AC-6: BL edits like any other: SUM(BG) with its note, and a field with no formula has no Edit formula', async ({ page }) => {
    await openEditor(page, 'BL');
    await expect(page.getByRole('heading', { level: 1, name: /^Edit formula: BL/ })).toBeVisible();
    await expect(box(page)).toHaveValue('SUM(BG)');
    await expect(page.getByText("SUM(BG) adds the BG of every row. Each row's BG already holds the count for the whole order, so nothing is multiplied by the rows above. BN and BO read from it.")).toBeVisible();
    await page.goto('/config/fields');
    for (const letter of ['A', 'F', 'I', 'BO']) {
      const row = page.locator('[data-field-id]:visible').filter({ has: page.getByText(`Excel column ${letter}`, { exact: true }) });
      await expect(row).toBeVisible();
      await expect(row.getByRole('link', { name: /^Edit formula/ })).toHaveCount(0);
    }
  });

  test('AC-6: an address that holds no field with a formula says so and offers the way back', async ({ page }) => {
    await page.goto('/config/fields/00000000-0000-4000-8000-00000000dead/formula');
    await expect(page.getByRole('heading', { name: 'This field has no formula to edit' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to Fields and formulas' }).click();
    await expect(page).toHaveURL(/\/config\/fields$/);
  });

  test('AC-5: a save is stored as a new version and says so, and the editor then has nothing left to save', async ({ page }) => {
    // The three projects share one database and one Admin, and each saves: a save of another project can land between this test's reading of the version and its own save, which is the very conflict AC-9
    // is about. So a save that meets one is made again from a fresh editor (at most three times). The field is Bending Cost (AM), which no other spec reads, and the new text gives the same figures as the
    // saved one (plus zero times a number of its own), so no other test's figures move.
    let saved = false;
    for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
      await openEditorDirectly(page, 'AM');
      await typeFormula(page, `${await box(page).inputValue()} + 0 * ${String(Math.floor(Math.random() * 1_000_000))}`);
      await expect(saveButton(page)).toBeEnabled();
      await saveButton(page).click();
      const dialog = page.getByRole('dialog', { name: 'Confirm with your password' });
      await dialog.getByLabel('Your password').fill(E2E_PASSWORD);
      await dialog.getByRole('button', { name: 'Save formula' }).click();
      const done = page.getByRole('status').filter({ hasText: /Formula saved as configuration version \d+\./ });
      const conflict = page.getByRole('status').filter({ hasText: 'The fields and formulas changed while you were editing' });
      await expect(done.or(conflict)).toBeVisible();
      saved = await done.isVisible();
    }
    expect(saved, 'a save that is not met by another project\'s save').toBe(true);
    await expect(saveButton(page)).toBeDisabled();
    await expect(page.getByRole('link', { name: 'Back to Fields and formulas' })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('AC-9: a window opened before another save still holds the old version: its save is refused with the 409 sentence and the number of the latest version, and what it typed is kept', async ({ page, request }) => {
    await openEditorDirectly(page, 'AM');
    const typed = `${await box(page).inputValue()} + 0 * 1`;
    // Another save, made through the API (the same route the editor uses), moves the version on while this window is open.
    const origin = new URL(page.url()).origin;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = (await (await request.get('/api/v1/config/current')).json()) as { readonly number: number };
      const moved = await request.put(`/api/v1/config/fields/${fieldIdOf('AM')}/formula`, {
        headers: { origin },
        data: { text: `${typed} + 0 * ${String(Math.floor(Math.random() * 1_000_000))}`, password: E2E_PASSWORD, baseVersion: current.number },
      });
      if (moved.ok()) break;
      expect(moved.status(), 'only another save can refuse this one').toBe(409);
    }
    await typeFormula(page, typed);
    await expect(saveButton(page)).toBeEnabled();
    await saveButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'Confirm with your password' });
    await dialog.getByLabel('Your password').fill(E2E_PASSWORD);
    await dialog.getByRole('button', { name: 'Save formula' }).click();
    await expect(page.getByText('The fields and formulas changed while you were editing')).toBeVisible();
    await expect(page.getByText(/They are now at configuration version \d+/)).toBeVisible();
    await expect(box(page)).toHaveValue(typed);
    await expect(saveButton(page)).toBeDisabled();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('the Lead', () => {
  test.use({ storageState: SIGNED_IN_STATE });

  test('AC-7: is sent no Edit formula on SCR-17, and the editor page and its routes are refused (403)', async ({ page }) => {
    await page.goto('/config/fields');
    await expect(page.getByText('View only.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Edit formula/ })).toHaveCount(0);
    const refusedPage = await page.goto('/config/fields/00000000-0000-4000-8000-0000000000f1/formula');
    expect(refusedPage?.status()).toBe(403);
    const sampleRows = await page.request.get('/api/v1/config/sample-rows');
    expect(sampleRows.status()).toBe(403);
  });
});
