import { expect, test } from '@playwright/test';

import { defined } from '../support/defined';

import { useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET } from './support/design-system';
import { ALPHA_MATERIAL, control, isPatchOfInputs, isPhone, NUMBER_RULE, nextSave, openForm, partForm, showTree, tree, waitForForm } from './support/part-form';

/**
 * STORY-05.03 T8 (AC-1 to AC-6, AC-8, AC-9; review SQR-11): the part form of SCR-05 for an Engineer, at 360x800, 768x1024 and 1366x768 on the development server. Each test
 * signs in as a person of its own, who owns a task with an empty draft estimate and one part (the recipe of the confidentiality scan, `tests/support/estimate-recipe.ts`),
 * chooses the customer so the form opens, and types into the part with the keyboard. The words are the UX spec's and the story's, written out here and not imported, so a changed
 * sentence fails a test; the field IDs are the seed registry's, which the server's form is built from. What the database holds (the revisions, the transaction, the lock) is judged in
 * `tests/integration/estimates/form.test.ts`. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const QTY_HINT = 'Enter the count for the whole order, not per assembly. For example, 24 lids in all, even if each pipe has 4.';
/** The words with "cost" in them that the form may say: the four typed inputs (FR-008) and the name of section 08 (SPEC 7.1). */
const ALLOWED_COST_WORDS = ['Fasteners Cost', 'Machining Cost', 'Plating Cost', 'Tool Cost', 'Other Costs and Remarks'];

test.describe('AC-1, AC-2, AC-3, AC-8: what the form shows', () => {
  test('AC-1: sections 01 and 02 with their numbers, names and column ranges, and an Excel letter on every field that a screen reader reads first', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const first = page.getByRole('region', { name: '01 Part Details' });
    const second = page.getByRole('region', { name: '02 Material and Dimensions' });
    await expect(first).toBeVisible();
    await expect(second).toBeVisible();
    // STORY-05.04: the tag of 01 also names the placeholder of Treatment / Color (G), which is in the card but is not typed into until story 05.06.
    await expect(first).toContainText('A, B, D, G, H');
    await expect(second).toContainText('E, F, J–L, N');

    for (const [letter, name, role] of [
      ['A', 'Sl. No', 'textbox'],
      ['B', 'Part No.', 'textbox'],
      ['D', 'Description', 'textbox'],
      ['H', 'QTY per Assy', 'textbox'],
      ['E', 'Material in Drawing', 'combobox'],
      ['F', 'Material Considered', 'textbox'],
      ['J', 'Length', 'textbox'],
      ['K', 'Width', 'textbox'],
      ['L', 'Thickness', 'textbox'],
      ['N', 'Part Weight', 'textbox'],
    ] as const) {
      // "Excel column J" comes first in the accessible name, then the label.
      await expect(page.getByRole(role, { name: new RegExp(`^Excel column ${letter}\\s+${name.replaceAll('.', '\\.')}`) })).toHaveCount(1);
      await expect(control(page, letter)).toBeVisible();
    }
    // Letters that are not typed into on the form are not controls: the picture, the placeholder of Treatment / Color, and Material Rate / Kg.
    for (const letter of ['C', 'G', 'I']) await expect(page.getByRole('textbox', { name: new RegExp(`^Excel column ${letter}\\s`) })).toHaveCount(0);
  });

  test('AC-2, AC-3, AC-8: the label stays "QTY per Assy" with the hint; Sl. No. and Material Considered are read-only; no rate, price, cost or formula is on the form', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await expect(control(page, 'H')).toHaveAccessibleDescription(QTY_HINT);
    await expect(partForm(page).getByText(QTY_HINT)).toBeVisible();
    await expect(control(page, 'A')).toHaveAttribute('readonly', '');
    await expect(control(page, 'A')).toHaveValue('1');
    await expect(control(page, 'F')).toHaveAttribute('readonly', '');
    await expect(control(page, 'F')).toHaveValue('');
    // The word "cost" is in the labels of the four inputs an Engineer types and in the name of section 08, and nowhere else (STORY-05.04 AC-7).
    const text = await partForm(page).innerText();
    expect(ALLOWED_COST_WORDS.reduce((left, words) => left.replaceAll(words, ''), text)).not.toMatch(/rate|price|cost|formula/i);
    expect(await page.content()).not.toMatch(/Material Rate|Rate \/ Kg/);
  });

  test('AC-1: the cards sit one above the other on a phone and side by side from a tablet', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const first = defined(await page.getByRole('region', { name: '01 Part Details' }).boundingBox());
    const second = defined(await page.getByRole('region', { name: '02 Material and Dimensions' }).boundingBox());
    // What the layout is, so a failure says why: the width of the form and the columns the grid made.
    const layout = await partForm(page).evaluate((form) => ({
      formWidth: form.getBoundingClientRect().width,
      columns: getComputedStyle(form.querySelector('[data-part-grid]') ?? form).gridTemplateColumns,
      viewport: window.innerWidth,
    }));
    const why = `layout ${JSON.stringify(layout)}, first ${JSON.stringify(first)}, second ${JSON.stringify(second)}`;
    if (isPhone(page)) {
      expect(second.y, why).toBeGreaterThanOrEqual(first.y + first.height);
      expect(Math.abs(second.x - first.x), why).toBeLessThan(2);
    } else {
      expect(Math.abs(second.y - first.y), why).toBeLessThan(2);
      expect(second.x, why).toBeGreaterThan(first.x + first.width - 2);
    }
  });
});

test.describe('AC-4, AC-5, AC-7: typing, refusing and saving', () => {
  test('AC-4: -1, 1.234 and abc are refused under the field with the words of the rule and the typed text is kept; 12.5 is saved as 12.50 and survives a reload; a blank is saved too', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const length = control(page, 'J');
    for (const typed of ['-1', '1.234', 'abc']) {
      await length.fill(typed);
      await length.blur();
      await expect(partForm(page).getByText(NUMBER_RULE)).toBeVisible();
      await expect(length).toHaveValue(typed);
      await expect(length).toHaveAttribute('aria-invalid', 'true');
    }

    const saved = nextSave(page);
    await length.fill('12.5');
    await length.blur();
    expect(await saved).toBe(200);
    await expect(length).toHaveValue('12.50');
    await expect(partForm(page).getByText(NUMBER_RULE)).toHaveCount(0);
    await expect(length).not.toHaveAttribute('aria-invalid', 'true');
    await expect(partForm(page).getByText(/^Last saved /)).toBeVisible();

    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'J')).toHaveValue('12.50');

    const cleared = nextSave(page);
    await control(page, 'J').fill('');
    await control(page, 'J').blur();
    expect(await cleared).toBe(200);
    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'J')).toHaveValue('');
  });

  test('AC-4, AC-7: text is saved by leaving the field and a value equal after normalisation sends nothing', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const saved = nextSave(page);
    await control(page, 'B').fill('  FR-1  ');
    await control(page, 'B').blur();
    expect(await saved).toBe(200);
    await expect(control(page, 'B')).toHaveValue('FR-1');

    const savedWidth = nextSave(page);
    await control(page, 'K').fill('1.5');
    await control(page, 'K').blur();
    expect(await savedWidth).toBe(200);
    await expect(control(page, 'K')).toHaveValue('1.50');
    await expect(partForm(page).getByText(/^Last saved /)).toBeVisible();
    const requests: string[] = [];
    page.on('request', (request) => {
      if (isPatchOfInputs(request.url(), request.method())) requests.push(request.url());
    });
    // The same number again, spelled another way, is no change: nothing is sent.
    await control(page, 'K').fill('1.50');
    await control(page, 'K').blur();
    await control(page, 'K').fill('01.5');
    await control(page, 'K').blur();
    await expect(control(page, 'K')).toHaveValue('1.50');
    expect(requests).toEqual([]);
  });

  test('AC-5, AC-3: the material list has the canary material by name; choosing it fills Material Considered, saves, and survives a reload; no price is on the page', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const select = control(page, 'E');
    await expect(select.locator('option', { hasText: ALPHA_MATERIAL.materialInDrawing })).toHaveCount(1);
    const saved = nextSave(page);
    await select.selectOption({ label: ALPHA_MATERIAL.materialInDrawing });
    expect(await saved).toBe(200);
    await expect(control(page, 'F')).toHaveValue(ALPHA_MATERIAL.materialConsidered);

    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'E').locator('option:checked')).toHaveText(ALPHA_MATERIAL.materialInDrawing);
    await expect(control(page, 'F')).toHaveValue(ALPHA_MATERIAL.materialConsidered);
    const content = await page.content();
    for (const number of [ALPHA_MATERIAL.pricePerKg, ALPHA_MATERIAL.specificGravity, ALPHA_MATERIAL.scrapRate]) expect(content).not.toContain(number);
  });

  test('SQR-01 (b): typing into a part moves the part\'s revision, and the tree follows: the part can still be deleted at once, with no "changed by someone else" notice', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const saved = nextSave(page);
    await control(page, 'L').fill('3');
    await control(page, 'L').blur();
    expect(await saved).toBe(200);
    await expect(control(page, 'L')).toHaveValue('3.00');

    await showTree(page);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete part 1?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete part' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Part deleted')).toHaveCount(1);
    await expect(page.getByText('The parts were changed by someone else.')).toHaveCount(0);
  });
});

test.describe('AC-6: Enter moves to the next field', () => {
  test('AC-6: Enter goes through Part No., Description, QTY per Assy, Material in Drawing, Length, Width, Thickness, Part Weight and on into section 03, skips the read-only fields, and never submits', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const address = page.url();
    await control(page, 'B').focus();
    await control(page, 'B').fill('FR-1');
    // The chain goes on through every section after 02 (STORY-05.04): the whole chain, to Remarks and the heading, is in `estimate-form-sections.spec.ts`.
    for (const next of ['D', 'H', 'E', 'J', 'K', 'L', 'N', 'P']) {
      await page.keyboard.press('Enter');
      await expect(control(page, next), `Enter should reach ${next}`).toBeFocused();
    }
    expect(page.url()).toBe(address);
    // The form was not submitted: the typed text is still there, saved by leaving its field.
    await expect(control(page, 'B')).toHaveValue('FR-1');
  });

  test('SQR-11: Enter on a part in the tree opens its form: the first field takes the focus', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await showTree(page);
    await tree(page).getByRole('treeitem').first().focus();
    await page.keyboard.press('Enter');
    await expect(control(page, 'B')).toBeFocused();
    // On a phone the drawer has closed.
    if (isPhone(page)) await expect(page.getByRole('dialog', { name: 'Parts tree' })).toHaveCount(0);
  });
});

test.describe('AC-9: the screen', () => {
  test('AC-9: no sideways scroll, axe finds nothing (with an error showing and with a value saved), every control is 44 px high and every label is visible', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    for (const letter of ['A', 'B', 'D', 'H', 'E', 'F', 'J', 'K', 'L', 'N']) {
      expect((await control(page, letter).boundingBox())?.height ?? 0, letter).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    for (const label of ['Sl. No', 'Part No.', 'Description', 'QTY per Assy', 'Material in Drawing', 'Material Considered', 'Length', 'Width', 'Thickness', 'Part Weight']) {
      await expect(partForm(page).locator('label', { hasText: label }).first(), label).toBeVisible();
    }

    await control(page, 'J').fill('-1');
    await control(page, 'J').blur();
    await expect(partForm(page).getByText(NUMBER_RULE)).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    const saved = nextSave(page);
    await control(page, 'J').fill('7');
    await control(page, 'J').blur();
    expect(await saved).toBe(200);
    await expect(control(page, 'J')).toHaveValue('7.00');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });
});
