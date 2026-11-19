import { expect, test, type Page } from '@playwright/test';

import { FIELD_ID_NAMESPACE, seedId } from '../../prisma/seed/config/seed-sections-and-stages';
import { columnLetterToIndex } from '../../src/lib/columns';
import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { defined } from '../support/defined';

import { makeCanaryEstimateCalculable, useFreshAddress } from './support/auth';
import { horizontalOverflow, TOUCH_TARGET } from './support/design-system';
import { ALPHA_MATERIAL, control, expectFormAccessible, isPatchOfInputs, isPhone, NUMBER_RULE, nextSave, openForm, partForm, showTree, tree, waitForForm } from './support/part-form';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-05.04 T7 (AC-1 to AC-8): the other sections of the part form of SCR-05 for an Engineer, at 360x800, 768x1024 and 1366x768 on the development server: cards 03 to 08 with their
 * counts, the rupee add-on and hints, Fasteners with its default, Remarks, the sticky strip of jump links, the placeholders, and what an Engineer is sent. Each test signs in as a person of its
 * own with an empty draft estimate and one part (`support/part-form.ts`). The words are the UX spec's and the story's, written out here and not imported, so a changed sentence fails a
 * test. What the database holds is judged in `tests/integration/estimates/form-sections.test.ts`. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const REMARKS_ID = seedId(FIELD_ID_NAMESPACE, columnLetterToIndex('AJ'));
const ALPHA_CUSTOMER_ID = defined(CUSTOMER_CANARIES[0]).id;
const COST_HINT = 'Enter 0 if there is none.';
const FASTENERS_HINT = 'Type "None" if the part has no fasteners.';
const REMARKS_HINT = 'Write "None" if there is nothing to add.';
const REMARKS_TOO_LONG = 'Use 1,000 characters or fewer.';
/** The cost inputs that show at first paint. Fasteners Cost (U) shows only once Fasteners is not "None": `estimate-fasteners.spec.ts` (STORY-05.05). */
const COST_LETTERS = ['AP', 'AU', 'BM'] as const;
/** The words with "cost" in them that the form may say: the four typed inputs (FR-008) and the name of section 08 (SPEC 7.1). */
const ALLOWED_COST_WORDS = ['Fasteners Cost', 'Machining Cost', 'Plating Cost', 'Tool Cost', 'Other Costs and Remarks'];
/** Every field a person types into, in the order of the form (08 shows AP, AU, BM, then AJ). */
const FORM_ORDER = ['B', 'D', 'G', 'H', 'E', 'J', 'K', 'L', 'N', 'P', 'Q', 'R', 'S', 'V', 'W', 'X', 'Y', 'AP', 'AU', 'BM', 'AJ'] as const;

const SECTIONS = [
  { number: '01', region: '01 Part Details', range: 'A–D, G, H', count: '0 of 4 complete', link: '01 Part details' },
  { number: '02', region: '02 Material and Dimensions', range: 'E, F, J–L, N', count: '0 of 5 complete', link: '02 Material' },
  { number: '03', region: '03 Cutting Process', range: 'P, Q', count: '0 of 2 complete', link: '03 Cutting' },
  { number: '04', region: '04 Bending', range: 'R', count: '0 of 1 complete', link: '04 Bending' },
  // Fasteners starts with its default "None", which counts as filled in; Qty and Cost are hidden by it, so they are not counted (STORY-05.05 AC-1).
  { number: '05', region: '05 Fasteners', range: 'S–U', count: '1 of 1 complete', link: '05 Fasteners' },
  { number: '06', region: '06 Welding', range: 'V–Y', count: '0 of 4 complete', link: '06 Welding' },
  { number: '07', region: '07 Surface Treatment', range: 'Z–AG', count: null, link: '07 Surface' },
  { number: '08', region: '08 Other Costs and Remarks', range: 'AJ, AP, AU, BM', count: '0 of 4 complete', link: '08 Other' },
] as const;

const region = (page: Page, name: string) => page.getByRole('region', { name });
const strip = (page: Page) => page.getByRole('navigation', { name: 'Sections of the form' });

/** The part's values as the server holds them, by field ID (the estimate and its one part have the person's ID). */
async function storedValues(page: Page, id: string): Promise<Record<string, unknown>> {
  const response = await page.request.get(`/api/v1/estimates/${id}/nodes/${id}`);
  expect(response.status()).toBe(200);
  return (await response.json()) as Record<string, unknown>;
}

test.describe('AC-1, AC-6: the sections, their headers, the strip and the placeholders', () => {
  test('AC-1: cards 01 to 08 with number, name, column range tag and "n of m" complete; an Excel letter on every field of the new cards, read first', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    for (const section of SECTIONS) {
      const card = region(page, section.region);
      await expect(card, section.region).toBeVisible();
      await expect(card).toContainText(section.range);
      if (section.count === null) await expect(card).not.toContainText(/\d+ of \d+ complete/);
      else await expect(card).toContainText(section.count);
    }
    for (const [letter, name] of [
      ['P', 'Cutting Time'],
      ['Q', 'Cutting Length'],
      ['R', 'No\\. of Bend'],
      // Fasteners Qty (T) and Cost (U) are hidden while Fasteners is "None": `estimate-fasteners.spec.ts` covers them (STORY-05.05).
      ['S', 'Fasteners'],
      ['V', 'Weld'],
      ['W', 'Drilling'],
      ['X', 'Tapping'],
      ['Y', 'CSK'],
      ['AP', 'Machining Cost'],
      ['AU', 'Plating Cost'],
      ['BM', 'Tool Cost'],
      ['AJ', 'Remarks'],
    ] as const) {
      await expect(page.getByRole('textbox', { name: new RegExp(`^Excel column ${letter}\\s+${name}`) })).toHaveCount(1);
      await expect(control(page, letter)).toBeVisible();
    }
  });

  test('AC-1: the counts follow what is typed: a value filled in and left raises "n of m", and a wrong one does not count', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const cutting = region(page, '03 Cutting Process');
    await control(page, 'P').fill('-1');
    await control(page, 'P').blur();
    await expect(cutting).toContainText('0 of 2 complete');
    const saved = nextSave(page);
    await control(page, 'P').fill('38.5');
    await control(page, 'P').blur();
    expect(await saved).toBe(200);
    await expect(cutting).toContainText('1 of 2 complete');
    const savedQ = nextSave(page);
    await control(page, 'Q').fill('960');
    await control(page, 'Q').blur();
    expect(await savedQ).toBe(200);
    await expect(cutting).toContainText('2 of 2 complete');
    // A card that is all filled in has a check in the strip, spoken as "All filled in".
    await expect(strip(page).getByRole('link', { name: /^03 Cutting\s*All filled in$/ })).toBeVisible();
    await expect(strip(page).getByRole('link', { name: /^04 Bending$/ })).toBeVisible();
  });

  test('AC-6: a sticky strip of 8 jump links, one to each card, that stays in view while the form scrolls; a link takes the focus to its card', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await expect(strip(page).getByRole('link')).toHaveCount(8);
    for (const section of SECTIONS) await expect(strip(page).getByRole('link', { name: section.link })).toBeVisible();

    await control(page, 'AJ').scrollIntoViewIfNeeded();
    await expect(strip(page)).toBeInViewport();

    await strip(page).getByRole('link', { name: '08 Other' }).click();
    await expect(page.getByRole('heading', { name: '08 Other Costs and Remarks' })).toBeFocused();
    await expect(region(page, '08 Other Costs and Remarks')).toBeInViewport();
    // The heading is clear of the strip (WCAG 2.4.11): its top is below the strip's bottom.
    const heading = await page.getByRole('heading', { name: '08 Other Costs and Remarks' }).boundingBox();
    const bar = await strip(page).boundingBox();
    expect((heading?.y ?? 0) + 1).toBeGreaterThanOrEqual((bar?.y ?? 0) + (bar?.height ?? 0));

    await strip(page).getByRole('link', { name: '01 Part details' }).click();
    await expect(page.getByRole('heading', { name: '01 Part Details' })).toBeFocused();
  });

  test('AC-6 (STORY-05.06): Treatment / Color (G) in 01 is a drop-down that is counted, and the eight treatments of 07 are one multi-select that is not; there is no placeholder any more', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await expect(region(page, '01 Part Details').getByRole('combobox', { name: /^Excel column G\s+Treatment \/ Color/ })).toBeVisible();
    await expect(region(page, '01 Part Details')).toContainText('0 of 4 complete');
    await expect(region(page, '07 Surface Treatment').getByRole('button', { name: /^Surface treatments/ })).toBeVisible();
    await expect(region(page, '07 Surface Treatment').getByRole('button')).toHaveCount(1);
    await expect(region(page, '07 Surface Treatment')).not.toContainText('of 0 complete');
    await expect(page.getByText('Not available yet')).toHaveCount(0);
  });
});

test.describe('AC-2, AC-3, AC-4, AC-5: typing into the new fields', () => {
  test('AC-2: the cost-typed inputs have the rupee add-on and the hint "Enter 0 if there is none."; what is typed is shown back as typed, with two decimals, and survives a reload', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    for (const letter of COST_LETTERS) {
      await expect(control(page, letter), letter).toHaveAccessibleDescription(COST_HINT);
      await expect(control(page, letter).locator('xpath=following-sibling::span'), letter).toHaveText('₹');
    }
    const saved = nextSave(page);
    await control(page, 'BM').fill('4321.5');
    await control(page, 'BM').blur();
    expect(await saved).toBe(200);
    await expect(control(page, 'BM')).toHaveValue('4321.50');
    await page.reload();
    await expect(control(page, 'BM')).toHaveValue('4321.50');
    await expect(region(page, '08 Other Costs and Remarks')).toContainText('1 of 4 complete');
  });

  test('AC-3: Fasteners shows "None" on a new part with its hint, is stored only once changed, and T and U are plain number inputs once they show', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    await expect(control(page, 'S')).toHaveValue('None');
    await expect(control(page, 'S')).toHaveAccessibleDescription(FASTENERS_HINT);
    // Qty and Cost are hidden while Fasteners is "None" (STORY-05.05 AC-1); typing another word shows them, as plain number inputs.
    await expect(control(page, 'T')).toHaveCount(0);
    await expect(control(page, 'U')).toHaveCount(0);
    await control(page, 'S').fill('M6 bolt');
    await expect(control(page, 'T')).toBeVisible();
    await expect(control(page, 'U')).toBeVisible();
    await expect(control(page, 'T').locator('xpath=following-sibling::span')).toHaveCount(0);
    await control(page, 'S').fill('None');
    await control(page, 'S').blur();

    const requests: string[] = [];
    page.on('request', (request) => {
      if (isPatchOfInputs(request.url(), request.method())) requests.push(request.url());
    });
    // Leaving it as it is changes nothing: no save, and the part still has nothing stored.
    await control(page, 'S').focus();
    await control(page, 'S').blur();
    expect(requests).toEqual([]);
    expect(await storedValues(page, owner.id)).toMatchObject({ completeness: 'EMPTY', inputs: [] });

    const saved = nextSave(page);
    await control(page, 'S').fill('M6 bolt');
    await control(page, 'S').blur();
    expect(await saved).toBe(200);
    await page.reload();
    await expect(control(page, 'S')).toHaveValue('M6 bolt');
  });

  test('AC-3: clearing Fasteners shows "None" again, and a stored value is removed', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    const saved = nextSave(page);
    await control(page, 'S').fill('M6 bolt');
    await control(page, 'S').blur();
    expect(await saved).toBe(200);
    const cleared = nextSave(page);
    await control(page, 'S').fill('');
    await control(page, 'S').blur();
    expect(await cleared).toBe(200);
    await expect(control(page, 'S')).toHaveValue('None');
    expect(await storedValues(page, owner.id)).toMatchObject({ completeness: 'EMPTY', inputs: [] });
  });

  test('AC-4: Remarks is a box of several lines: Shift+Enter starts a new line, Enter moves on, the hint is under it, and the text survives a reload', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const remarks = control(page, 'AJ');
    await expect(remarks).toHaveAccessibleDescription(REMARKS_HINT);
    expect(await remarks.evaluate((element) => element.tagName)).toBe('TEXTAREA');
    // The box is at least three lines tall, from its token and not a size of the default scale.
    expect((await remarks.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(90);
    await remarks.focus();
    await page.keyboard.type('Line one');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('Line two');
    await expect(remarks).toHaveValue('Line one\nLine two');
    await expect(remarks).toBeFocused();
    const saved = nextSave(page);
    await page.keyboard.press('Enter');
    expect(await saved).toBe(200);
    await expect(remarks).not.toBeFocused();
    await expect(remarks).toHaveValue('Line one\nLine two');
    await page.reload();
    await expect(control(page, 'AJ')).toHaveValue('Line one\nLine two');
  });

  test('AC-4: Remarks takes 1,000 characters and shows the message at 1,001 while it is typed; nothing is sent until it fits, and the text is kept', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const remarks = control(page, 'AJ');
    const requests: string[] = [];
    page.on('request', (request) => {
      if (isPatchOfInputs(request.url(), request.method())) requests.push(request.url());
    });
    await remarks.fill('x'.repeat(1001));
    await expect(partForm(page).getByText(REMARKS_TOO_LONG)).toBeVisible();
    await expect(remarks).toHaveAttribute('aria-invalid', 'true');
    await remarks.blur();
    await expect(remarks).toHaveValue('x'.repeat(1001));
    expect(requests).toEqual([]);

    const saved = nextSave(page);
    await remarks.fill('x'.repeat(1000));
    await expect(partForm(page).getByText(REMARKS_TOO_LONG)).toHaveCount(0);
    await remarks.blur();
    expect(await saved).toBe(200);
  });

  test('AC-5: every new number is refused when it is -1, 1.234 or abc, with the words of the rule and the typed text kept; 12.5 is saved as 12.50', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    // Fasteners Qty and Cost (T, U) take the same rule once they show: `estimate-fasteners.spec.ts`.
    for (const letter of ['P', 'Q', 'R', 'V', 'W', 'X', 'Y', 'AP', 'AU', 'BM']) {
      const field = control(page, letter);
      await field.fill('-1');
      await field.blur();
      await expect(field, letter).toHaveAttribute('aria-invalid', 'true');
      await expect(field, letter).toHaveValue('-1');
    }
    await expect(partForm(page).getByText(NUMBER_RULE).first()).toBeVisible();
    const saved = nextSave(page);
    await control(page, 'V').fill('12.5');
    await control(page, 'V').blur();
    expect(await saved).toBe(200);
    await expect(control(page, 'V')).toHaveValue('12.50');
  });

  test('AC-6 (Enter): Enter goes through every typed field in the order of the form, Shift+Enter in Remarks stays, and on the last field Enter moves focus to Calculate and never presses it (STORY-05.09 AC-9, which replaced "the heading"); the page address does not change', async ({
    page,
  }, testInfo) => {
    await openForm(page, testInfo);
    const address = page.url();
    let calculates = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/calculate')) calculates += 1;
    });
    await control(page, 'B').focus();
    for (const next of FORM_ORDER.slice(1)) {
      await page.keyboard.press('Enter');
      await expect(control(page, next), `Enter should reach ${next}`).toBeFocused();
    }
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Calculate', exact: true })).toBeFocused();
    expect(calculates, 'Enter moved to Calculate and did not press it').toBe(0);
    expect(page.url()).toBe(address);
  });
});

test.describe('AC-7: what an Engineer is sent', () => {
  test('AC-7 (NFR-002): the form, the part and the page carry no rate, calculated value or formula, with typed costs filled in and a material chosen; the typed costs are only what was typed', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    const savedMaterial = nextSave(page);
    await control(page, 'E').selectOption({ label: ALPHA_MATERIAL.materialInDrawing });
    expect(await savedMaterial).toBe(200);
    // Fasteners Cost shows only once the part has fasteners (STORY-05.05).
    const savedFasteners = nextSave(page);
    await control(page, 'S').fill('M6 bolt');
    await control(page, 'S').blur();
    expect(await savedFasteners).toBe(200);
    for (const [letter, typed] of [
      ['AP', '1234.5'],
      ['AU', '678.25'],
      ['BM', '45678.75'],
      ['U', '3.5'],
    ] as const) {
      const saved = nextSave(page);
      await control(page, letter).fill(typed);
      await control(page, letter).blur();
      expect(await saved).toBe(200);
    }

    const answers = [await page.request.get(`/api/v1/estimates/${owner.id}/form`), await page.request.get(`/api/v1/estimates/${owner.id}/nodes/${owner.id}`)];
    for (const answer of answers) {
      expect(answer.status()).toBe(200);
      const text = ALLOWED_COST_WORDS.reduce((left, words) => left.replaceAll(words, ''), await answer.text());
      expect(text).not.toMatch(/\{\{|formula|price|cost|rate/i);
      for (const number of [ALPHA_MATERIAL.pricePerKg, ALPHA_MATERIAL.specificGravity, ALPHA_MATERIAL.scrapRate]) expect(text).not.toContain(number);
    }
    const part = (await answers[1]?.json()) as { readonly inputs: ReadonlyArray<{ readonly value: string }> };
    for (const typed of ['1234.50', '678.25', '45678.75', '3.50']) expect(part.inputs.map((entry) => entry.value)).toContain(typed);

    const text = ALLOWED_COST_WORDS.reduce((left, words) => left.replaceAll(words, ''), await partForm(page).innerText());
    expect(text).not.toMatch(/rate|price|cost|formula/i);
    const content = ALLOWED_COST_WORDS.reduce((left, words) => left.replaceAll(words, ''), await page.content());
    expect(content).not.toMatch(/Material Rate|Rate \/ Kg/);
    for (const number of [ALPHA_MATERIAL.pricePerKg, ALPHA_MATERIAL.specificGravity, ALPHA_MATERIAL.scrapRate]) expect(content).not.toContain(number);
  });
});

test.describe('AC-8: the screen at 360, 768 and 1366 px', () => {
  test('AC-8: no sideways scroll, axe finds nothing (with a message showing and with values saved), every control is 44 px high and the strip links too', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectFormAccessible(page);

    for (const letter of FORM_ORDER) expect((await control(page, letter).boundingBox())?.height ?? 0, letter).toBeGreaterThanOrEqual(TOUCH_TARGET);
    for (const link of await strip(page).getByRole('link').all()) expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);

    await control(page, 'P').fill('-1');
    await control(page, 'P').blur();
    await control(page, 'AJ').fill('x'.repeat(1001));
    await expect(partForm(page).getByText(REMARKS_TOO_LONG)).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectFormAccessible(page);

    await control(page, 'AJ').fill('Invented remark');
    await control(page, 'AJ').blur();
    await control(page, 'P').fill('7');
    await control(page, 'P').blur();
    await expect(control(page, 'P')).toHaveValue('7.00');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectFormAccessible(page);
  });

  test('AC-8: tabbing through the whole form, a focused field is never behind the sticky strip or the top bar (WCAG 2.4.11)', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await control(page, 'B').focus();
    const hidden: string[] = [];
    for (let press = 0; press < FORM_ORDER.length; press += 1) {
      await page.keyboard.press('Tab');
      // Where the focused control is, against the bottom of the sticky bars at the top of the page.
      const covered = await page.evaluate(() => {
        const active = document.activeElement;
        const bars = [...document.querySelectorAll<HTMLElement>('[data-sticky-bar="top"]')];
        if (active === null || bars.some((bar) => bar.contains(active))) return null;
        const top = Math.max(0, ...bars.map((bar) => bar.getBoundingClientRect().bottom));
        const box = active.getBoundingClientRect();
        return box.top < top - 1 ? `${active.id || active.tagName} top ${Math.round(box.top)} under the bars that end at ${Math.round(top)}` : null;
      });
      if (covered !== null) hidden.push(covered);
    }
    expect(hidden).toEqual([]);
  });

  test('AC-8: the strip scrolls inside itself on a phone and the page does not scroll sideways, and keyboard only reaches every link and field', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    const links = await strip(page).getByRole('link').all();
    expect(links).toHaveLength(8);
    await defined(links[0]).focus();
    for (let index = 1; index < links.length; index += 1) {
      await page.keyboard.press('Tab');
      await expect(defined(links[index]), `Tab should reach strip link ${index + 1}`).toBeFocused();
    }
    // The first field of the first card is the read-only Sl. No., which takes the focus too; Part No. is next.
    await page.keyboard.press('Tab');
    await expect(control(page, 'A')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(control(page, 'B')).toBeFocused();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

const progressLine = (page: Page) => partForm(page).locator('[data-part-progress]');

test.describe('STORY-05.11 AC-1, AC-4, AC-7, AC-8: the completion line, the tree icon and the polite status', () => {
  test('AC-1, AC-8: "n of m inputs complete" for the part, with a named progress bar that follows what is typed; Fasteners shows and hides its two fields in the count', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    // Fasteners shows its default "None", which counts; Part Model and the surface treatments are in no count (21 fields to fill, 1 of them showing a value).
    await expect(progressLine(page)).toContainText('1 of 21 inputs complete');
    const bar = partForm(page).getByRole('progressbar', { name: 'Inputs complete for part 1' });
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('aria-valuenow', '1');
    await expect(bar).toHaveAttribute('aria-valuemax', '21');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    // A wrong number is not a value; a right one counts; 0 is a value.
    await control(page, 'P').fill('-1');
    await control(page, 'P').blur();
    await expect(progressLine(page)).toContainText('1 of 21 inputs complete');
    const saved = nextSave(page);
    await control(page, 'P').fill('0');
    await control(page, 'P').blur();
    expect(await saved).toBe(200);
    await expect(progressLine(page)).toContainText('2 of 21 inputs complete');
    await expect(bar).toHaveAttribute('aria-valuenow', '2');
    // Clearing a value takes it off the count again.
    await control(page, 'P').fill('');
    await control(page, 'P').blur();
    await expect(progressLine(page)).toContainText('1 of 21 inputs complete');

    // A field the registry hides for what is typed is not counted: another word in Fasteners shows Qty and Cost, which are two more to fill.
    const fasteners = nextSave(page);
    await control(page, 'S').fill('Invented bolts');
    await control(page, 'S').blur();
    expect(await fasteners).toBe(200);
    await expect(progressLine(page)).toContainText('1 of 23 inputs complete');
    await expectFormAccessible(page);
  });

  test('AC-4, AC-8: the save that completes a part changes its icon in the tree with no reload, and says "Part 1 is complete." once, politely', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    // The part is complete in the database except for Remarks, and the page is read again as the database has it.
    await makeCanaryEstimateCalculable(owner.id, ALPHA_MATERIAL.id, ALPHA_CUSTOMER_ID);
    const held = await page.request.get(`/api/v1/estimates/${owner.id}/nodes/${owner.id}`);
    const revision = ((await held.json()) as { revision: number }).revision;
    const cleared = await page.request.patch(`/api/v1/estimates/${owner.id}/nodes/${owner.id}/inputs`, {
      headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' },
      data: { revision, values: { [REMARKS_ID]: '' } },
    });
    expect(cleared.status()).toBe(200);
    expect(((await cleared.json()) as { completeness: string }).completeness).toBe('PARTIAL');
    await page.reload();
    await waitForForm(page);
    await expect(progressLine(page)).toContainText('20 of 21 inputs complete');
    // On a phone the tree is a drawer over the form, so it is opened once the typing is done.
    if (!isPhone(page)) {
      await showTree(page);
      const before = tree(page).getByRole('treeitem').first();
      await expect(before).toContainText('Some inputs entered');
      await expect(before.locator('[data-completeness="PARTIAL"]')).toHaveCount(1);
    }
    // The polite status says nothing while the part is not complete, and nothing on a save that leaves it so.
    const status = page.getByRole('status').filter({ hasText: 'Part 1 is complete.' });
    await expect(status).toHaveCount(0);

    const saved = nextSave(page);
    await control(page, 'AJ').fill('Invented remark');
    await control(page, 'AJ').blur();
    expect(await saved).toBe(200);
    await expect(progressLine(page)).toContainText('21 of 21 inputs complete');
    await expect(status).toHaveText('Part 1 is complete.');
    await showTree(page);
    const item = tree(page).getByRole('treeitem').first();
    await expect(item).toContainText('All inputs entered');
    await expect(item.locator('[data-completeness="COMPLETE"]')).toHaveCount(1);
    // The icons are decoration: the words carry the state.
    await expect(item.locator('svg[data-completeness]')).toHaveAttribute('aria-hidden', 'true');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectFormAccessible(page);
  });

  test('AC-2: a part with every input and no picture is complete (Part Model is optional)', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    await makeCanaryEstimateCalculable(owner.id, ALPHA_MATERIAL.id, ALPHA_CUSTOMER_ID);
    await page.reload();
    await waitForForm(page);
    await expect(progressLine(page)).toContainText('21 of 21 inputs complete');
    await showTree(page);
    await expect(tree(page).getByRole('treeitem').first()).toContainText('All inputs entered');
  });
});
