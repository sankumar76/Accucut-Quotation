import { expect, test, type Locator, type Page } from '@playwright/test';

import { FIELD_ID_NAMESPACE, seedId } from '../../prisma/seed/config/seed-sections-and-stages';
import { columnLetterToIndex } from '../../src/lib/columns';

import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE, SIGNED_IN_STATE } from './support/servers';

/**
 * STORY-08.03 (AC-1, AC-2, AC-3, AC-7, AC-10; FR-074, FR-075; NFR-016 to NFR-018): SCR-19 "Insert field" at 360x800, 768x1024 and 1366x768 on the development server, as the E2E Admin and the E2E Lead (the
 * saved browser states of the set-up project). The words are the UX spec's and the story's, written out here and not imported.
 *
 * What is checked: "Insert after" on a row of SCR-17 opens the wizard with that column chosen; the three steps by keyboard alone, with a polite status on each change and focus on the new step's heading; the
 * errors in a summary whose links go to the controls, each also under its control, and typing clears one; the live list "Letters after this insert" and the preview table, each a named, focusable region
 * that never widens the page; the pair, whose cost formula names the new input (decision D-1); an unknown name and a loop in the SCR-18 words; the success, the 409 and the failures; no sideways scroll,
 * controls of 44 px, axe 0 violations. The previews are real (they store nothing); **the save is answered by the test, never stored**: the three projects share one database, and a real insert would move
 * every letter and add a mandatory input that every other spec's Calculate would meet. The real save, one version for one field or two, the audit entry and the 409 are
 * `tests/integration/config/insert-field.test.ts` and `tests/unit/config-structure-routes.test.ts`.
 */

const fieldIdOf = (letter: string): string => seedId(FIELD_ID_NAMESPACE, columnLetterToIndex(letter));
const AFTER_AX = `/config/fields/new?after=${fieldIdOf('AX')}`;

const step = (page: Page, heading: string): Locator => page.getByRole('heading', { level: 2, name: heading });
const status = (page: Page): Locator => page.locator('[role="status"][aria-live="polite"]');
const control = (page: Page, id: string): Locator => page.locator(`#insert-${id}`);

/** The wizard by its address: the page, then the lazy steps, then React's handlers on the form (a click or an Enter before that is lost). */
async function openWizard(page: Page, address = AFTER_AX): Promise<void> {
  await page.goto(address);
  await expect(page.getByRole('heading', { level: 1, name: 'Insert field' })).toBeVisible();
  await expect(step(page, '1 · What do you want to add?')).toBeVisible();
  await waitUntilHydrated(page, 'form[aria-label="Insert field"]', 'onSubmit');
}

/** Step 1 to step 2 for a kind, the way a person does it: choose the card, then Next. */
async function toDetails(page: Page, kind: 'Input' | 'Output' | 'Input and its cost column'): Promise<void> {
  await openWizard(page);
  await page.getByRole('radio', { name: kind, exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(step(page, '2 · Details')).toBeVisible();
}

/** A valid input: a label and the first section. The place (AX) came with the address. */
async function fillInput(page: Page, label = 'Invented Notch Count'): Promise<void> {
  await control(page, 'input-label').fill(label);
  await control(page, 'input-sectionId').selectOption({ index: 1 });
}

/** The cost column of a pair: a label, the third stage and the formula. */
async function fillCost(page: Page, formula: string, label = 'Invented Notch Cost'): Promise<void> {
  await control(page, 'cost-label').fill(label);
  await control(page, 'cost-stageId').selectOption({ index: 3 });
  await control(page, 'cost-formula').fill(formula);
}

/** Does a preview body ask for the letters alone (the live list of step 2)? */
const asksForLettersOnly = (body: unknown): boolean => typeof body === 'object' && body !== null && Reflect.get(body, 'lettersOnly') === true;

const SAVE_ANSWER = { version: 99, letters: ['AY'], message: 'Inserted as AY. Configuration version 99.' };

/** Answers the save (`POST /api/v1/config/fields`) and nothing else; the options and the preview go to the real server. Returns what the browser sent. */
async function answerSave(page: Page, response: { readonly status: number; readonly body: unknown }): Promise<{ readonly sent: unknown[] }> {
  const sent: unknown[] = [];
  await page.route('**/api/v1/config/fields', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    sent.push(route.request().postDataJSON());
    return route.fulfill({ status: response.status, contentType: response.status === 200 ? 'application/json' : 'application/problem+json', body: JSON.stringify(response.body) });
  });
  return { sent };
}

test.describe('the Admin', () => {
  test.use({ storageState: ADMIN_STATE });

  test('AC-1, AC-2, AC-10: "Insert after" on a row of SCR-17 opens the wizard with that column chosen, on step 1 with the three kinds; no sideways scroll, axe 0', async ({ page }) => {
    await page.goto('/config/fields');
    const row = page.locator('[data-field-id]:visible').filter({ has: page.getByText('Excel column AX', { exact: true }) });
    await expect(row).toBeVisible();
    await row.getByRole('link', { name: /^Insert after/ }).click();
    await expect(page).toHaveURL(new RegExp(`/config/fields/new\\?after=${fieldIdOf('AX')}$`));
    await expect(step(page, '1 · What do you want to add?')).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Type of field' })).toBeVisible();
    for (const kind of ['Input', 'Output', 'Input and its cost column']) await expect(page.getByRole('radio', { name: kind, exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Input', exact: true })).toBeChecked();
    await expect(page.getByRole('list', { name: 'Steps' }).getByRole('listitem').filter({ hasText: 'What to add' })).toHaveAttribute('aria-current', 'step');
    expect((await page.getByRole('button', { name: 'Next', exact: true }).boundingBox() ?? { height: 0 }).height).toBeGreaterThanOrEqual(TOUCH_TARGET);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-2, AC-10: step 2 of an input has every control, the column from the address chosen, the three notices and the live list as a named, focusable region; no sideways scroll, axe 0', async ({ page }) => {
    await toDetails(page, 'Input');
    await expect(status(page)).toHaveText('Step 2 of 3: Details');
    await expect(step(page, '2 · Details')).toBeFocused();
    for (const label of ['Label', 'Type of value', 'Default value', 'Insert after column', 'Section of the Engineer form', 'Unit shown beside the input', 'Hint under the input', 'Excel column width', 'Excel number format']) {
      await expect(page.getByLabel(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('radio', { name: 'Always' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Only when another field has a value' })).toBeVisible();
    await expect(control(page, 'afterFieldId')).toHaveValue(fieldIdOf('AX'));
    await expect(page.getByText('New inputs are mandatory and visible to Engineers.')).toBeVisible();
    await expect(page.getByText("New outputs are hidden from Engineers and join a total only when that total's formula is edited.")).toBeVisible();
    const letters = page.getByRole('region', { name: 'Letters after this insert, scrollable' });
    await expect(letters).toHaveAttribute('tabindex', '0');
    // SPEC section 14 item 6: an input after AX is AY, and the column that was AY is AZ.
    await expect(letters).toContainText('AY');
    await expect(letters).toContainText('AZ');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-7, AC-10: Preview with nothing typed shows the errors in a summary of links, each under its control, focus on the first, and typing clears one; axe 0', async ({ page }) => {
    await toDetails(page, 'Input');
    await page.getByRole('button', { name: 'Preview' }).click();
    const summary = page.getByRole('alert').filter({ hasText: 'things need fixing.' });
    await expect(summary).toContainText('2 things need fixing.');
    await expect(summary.getByRole('link', { name: 'Enter a label.' })).toBeVisible();
    await expect(summary.getByRole('link', { name: 'Choose a section.' })).toBeVisible();
    await expect(control(page, 'input-label')).toBeFocused();
    await expect(control(page, 'input-label')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#insert-input-label-error')).toHaveText('Enter a label.');
    await expect(page.locator('#insert-input-sectionId-error')).toHaveText('Choose a section.');
    await expectNoAxeViolations(page);
    await summary.getByRole('link', { name: 'Choose a section.' }).click();
    await expect(control(page, 'input-sectionId')).toBeFocused();
    await control(page, 'input-label').fill('Invented Notch Count');
    await expect(page.locator('#insert-input-label-error')).toHaveCount(0);
    await expect(control(page, 'input-label')).not.toHaveAttribute('aria-invalid', 'true');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('AC-3, AC-10: the preview names the new field, lists the letters that change with the product cells (SPEC 14.6), in a named, focusable region; Back keeps what was typed', async ({ page }) => {
    await toDetails(page, 'Input');
    await fillInput(page);
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(step(page, '3 · Preview the letter changes')).toBeFocused();
    await expect(status(page)).toHaveText('Step 3 of 3: Preview and save');
    await expect(page.getByText('New fields: AY Invented Notch Count.')).toBeVisible();
    const table = page.getByRole('region', { name: 'Letters that change, scrollable' });
    await expect(table).toHaveAttribute('tabindex', '0');
    for (const heading of ['Was', 'Becomes', 'Field']) await expect(table.getByRole('columnheader', { name: heading })).toBeVisible();
    await expect(table).toContainText('Total Process Cost');
    for (const cell of ['its cell BL2 → BM2', 'its cell BN2 → BO2', 'its cell BO2 → BP2']) await expect(table.getByText(cell)).toBeVisible();
    await expect(page.getByText('The Excel export uses the new letters for estimates calculated from now on.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Insert', exact: true })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(step(page, '2 · Details')).toBeVisible();
    await expect(control(page, 'input-label')).toHaveValue('Invented Notch Count');
  });

  test('AC-2, AC-3, D-1: a pair\'s cost formula names the new input by its new letter; the live list shows both new letters and the preview says "Insert 2 fields"', async ({ page }) => {
    await toDetails(page, 'Input and its cost column');
    await expect(page.getByText('Its cost column (hidden from Engineers)')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Right after the new input' })).toBeChecked();
    await expect(page.getByLabel('Hide the line when this input is 0')).toBeChecked();
    await fillInput(page, 'Invented Rework Count');
    await fillCost(page, 'AY * 2');
    const letters = page.getByRole('region', { name: 'Letters after this insert, scrollable' });
    await expect(letters).toContainText('Invented Rework Count');
    await expect(letters).toContainText('Invented Notch Cost');
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByText('New fields: AY Invented Rework Count and AZ Invented Notch Cost.')).toBeVisible();
    await expect(page.getByText('AZ Invented Notch Cost: AY * 2')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Insert 2 fields' })).toBeVisible();
  });

  test('AC-7: an unknown name in the cost formula is refused in the SCR-18 words under the formula, with focus on it, and a single output that names its own new letter is a loop', async ({ page }) => {
    await toDetails(page, 'Input and its cost column');
    await fillInput(page);
    await fillCost(page, 'AY * Cuting-Rate-per-Sec');
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.locator('#insert-cost-formula-error')).toContainText('"Cuting-Rate-per-Sec" is not a column letter, rate name or function.');
    await expect(control(page, 'cost-formula')).toBeFocused();
    await expect(step(page, '2 · Details')).toBeVisible();
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('radio', { name: 'Output', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await control(page, 'output-label').fill('Invented Loop');
    await control(page, 'output-stageId').selectOption({ index: 3 });
    await control(page, 'output-formula').fill('AY * 2');
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.locator('#insert-output-formula-error')).toContainText('depend on itself');
  });

  test('AC-2, AC-10: all three steps by keyboard alone, the pair saved: a status on each step, focus on each new heading, Enter in a field previews, and the request holds no password', async ({ page }) => {
    const answered = await answerSave(page, { status: 200, body: SAVE_ANSWER });
    await openWizard(page);
    // Step 1: the arrow keys choose, Tab goes on (Cancel, then Next), Enter presses it.
    await page.getByRole('radio', { name: 'Input', exact: true }).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    // The arrows move to the third card; Space chooses it (a no-op when the move already did).
    await expect(page.getByRole('radio', { name: 'Input and its cost column' })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByRole('radio', { name: 'Input and its cost column' })).toBeChecked();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(step(page, '2 · Details')).toBeFocused();
    await expect(status(page)).toHaveText('Step 2 of 3: Details');
    // Step 2: typing, and Enter inside a field presses Preview.
    await fillInput(page, 'Invented Rework Count');
    await fillCost(page, 'AY * 2');
    await control(page, 'cost-label').press('Enter');
    await expect(step(page, '3 · Preview the letter changes')).toBeFocused();
    await expect(status(page)).toHaveText('Step 3 of 3: Preview and save');
    // Step 3: Tab to Insert 2 fields and press it.
    const insert = page.getByRole('button', { name: 'Insert 2 fields' });
    await insert.focus();
    await page.keyboard.press('Enter');
    // The success is the notice (the polite region above says it too, for a screen reader), and the notice takes focus so a keyboard user hears it and tabs on to the link.
    const done = page.locator('[data-slot="alert"]').filter({ hasText: 'Inserted as AY. Configuration version 99.' });
    await expect(done).toBeVisible();
    await expect(done).toHaveAttribute('role', 'status');
    await expect(status(page)).toHaveText('Inserted as AY. Configuration version 99.');
    await expect(page.locator('main [tabindex="-1"]').filter({ has: done })).toBeFocused();
    await expect(page.getByRole('link', { name: 'Back to Fields and formulas' })).toBeVisible();
    await expect(page.getByRole('radiogroup')).toHaveCount(0);
    // The body is the spec and the version the wizard was opened on, and nothing else: an insert asks for no password (FR-080).
    expect(answered.sent).toEqual([{ spec: expect.objectContaining({ kind: 'pair' }), baseVersion: expect.any(Number) }]);
    expect(JSON.stringify(answered.sent)).not.toMatch(/password/i);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    await page.getByRole('link', { name: 'Back to Fields and formulas' }).click();
    await expect(page).toHaveURL(/\/config\/fields$/);
  });

  test('AC-4: a version that moved on while the Admin was inserting is told in the 409 words with the newer number, with "Start again", and nothing is shown as inserted', async ({ page }) => {
    const sentence = 'The fields and formulas were changed while you were inserting. They are now at configuration version 12. Nothing was inserted; start again to see what changed.';
    await answerSave(page, { status: 409, body: { type: 'about:blank', title: sentence, status: 409, code: 'CONFIG_VERSION_CHANGED', currentVersion: 12 } });
    await toDetails(page, 'Input');
    await fillInput(page);
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(step(page, '3 · Preview the letter changes')).toBeVisible();
    await page.getByRole('button', { name: 'Insert', exact: true }).click();
    const notice = page.getByRole('alert').filter({ hasText: 'The fields and formulas changed while you were inserting' });
    await expect(notice).toContainText('They are now at configuration version 12.');
    await expect(notice.getByRole('button', { name: 'Start again' })).toBeVisible();
    await expect(page.getByText('Inserted as')).toHaveCount(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-4: a save that got no answer says it is not known whether the fields were inserted, and keeps the Admin on step 3', async ({ page }) => {
    await page.route('**/api/v1/config/fields', (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()));
    await toDetails(page, 'Input');
    await fillInput(page);
    await page.getByRole('button', { name: 'Preview' }).click();
    await page.getByRole('button', { name: 'Insert', exact: true }).click();
    const notice = page.getByRole('alert').filter({ hasText: 'We could not confirm the insert' });
    await expect(notice).toContainText('it is not known whether the fields were inserted');
    await expect(step(page, '3 · Preview the letter changes')).toBeVisible();
  });

  test('AC-2: a preview that got no answer says nothing was changed and keeps the Admin on step 2 with what was typed', async ({ page }) => {
    // The live list of step 2 (`lettersOnly`) goes to the real server; the preview of the press does not answer.
    await page.route('**/api/v1/config/fields/preview', (route) => (asksForLettersOnly(route.request().postDataJSON()) ? route.continue() : route.abort()));
    await toDetails(page, 'Input');
    await fillInput(page);
    await page.getByRole('button', { name: 'Preview' }).click();
    const notice = page.getByRole('alert').filter({ hasText: 'We could not work out the preview' });
    await expect(notice).toContainText('Nothing was changed.');
    await expect(step(page, '2 · Details')).toBeVisible();
    await expect(control(page, 'input-label')).toHaveValue('Invented Notch Count');
  });

  test('AC-1: the options that cannot be loaded show the error with "Try again", which opens the wizard once the portal answers', async ({ page }) => {
    await page.route('**/api/v1/config/insert-options', (route) => route.abort());
    await page.goto(AFTER_AX);
    await expect(page.getByRole('heading', { name: 'We could not load the insert wizard' })).toBeVisible();
    await page.unroute('**/api/v1/config/insert-options');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(step(page, '1 · What do you want to add?')).toBeVisible();
  });

  test('AC-1: an address with no column, or one that is no UUID, opens the wizard with no column chosen and the server\'s words when Preview is pressed', async ({ page }) => {
    await openWizard(page, '/config/fields/new?after=not-a-uuid');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(control(page, 'afterFieldId')).toHaveValue('');
    await expect(page.getByRole('region', { name: 'Letters after this insert, scrollable' })).toContainText('Choose the column to insert after to see the new letters.');
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.locator('#insert-afterFieldId-error')).toHaveText('Choose the column to insert after.');
  });
});

test.describe('the Lead', () => {
  test.use({ storageState: SIGNED_IN_STATE });

  test('AC-1: is sent no "Insert after" on SCR-17, and the wizard page and its routes are refused (403)', async ({ page }) => {
    await page.goto('/config/fields');
    await expect(page.getByText('View only.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Insert after/ })).toHaveCount(0);
    const refusedPage = await page.goto(AFTER_AX);
    expect(refusedPage?.status()).toBe(403);
    expect((await page.request.get('/api/v1/config/insert-options')).status()).toBe(403);
    const origin = new URL(page.url()).origin;
    expect((await page.request.post('/api/v1/config/fields/preview', { headers: { origin }, data: {} })).status()).toBe(403);
    expect((await page.request.post('/api/v1/config/fields', { headers: { origin }, data: {} })).status()).toBe(403);
  });
});
