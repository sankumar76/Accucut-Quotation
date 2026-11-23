import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { FIELD_ID_NAMESPACE, seedId } from '../../prisma/seed/config/seed-sections-and-stages';
import { columnLetterToIndex } from '../../src/lib/columns';
import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { canaryTaskCodeFor } from '../support/estimate-recipe';
import { defined } from '../support/defined';

import { connectToTestDatabase, ensureCanaryCustomers, ensureCanaryMaterials, setCanaryCustomer, useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET } from './support/design-system';
import { control, expectFormAccessible, expectNothingUnsaved, leastFieldHeight, nextSave, openForm, partForm, signInAsNewEngineer, waitForForm } from './support/part-form';
import { DEVELOPMENT_URL } from './support/servers';
import { deleteTreatment, insertTreatment, newTreatmentName, readPartInputs, renameTreatment, storeTreatmentInPart } from './support/treatment-rows';

/**
 * STORY-05.06 (AC-1 to AC-8; FR-049, FR-050, FR-018; architecture section 5.1 "A treatment on an estimate"): the eight surface treatments as one multi-select of section 07 and Treatment / Color (G)
 * of section 01, for an Engineer, at 360x800, 768x1024 and 1366x768 on the development server. Each test signs in as a person of its own with an empty draft estimate and one part
 * (`support/part-form.ts`) and, where it needs a treatment, makes one of its own. What the database holds is read back as it is stored. The words are the story's and the developer's, written out
 * here and not imported, so a changed sentence fails a test. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const OTHER_ID = '00000000-0000-4000-8000-000700000001';
const NOT_APPLICABLE_ID = '00000000-0000-4000-8000-000700000002';
const idOf = (letter: string): string => seedId(FIELD_ID_NAMESPACE, columnLetterToIndex(letter));
const G = idOf('G');
const FOAM = idOf('AF');
const ALL_TREATMENTS = ['Hot Dip Galvanizing', 'Primer', 'Shot Blasting', 'Polishing', 'Plating', 'Powder Coating', 'Foam', 'Soft Anodize'];
/** The Excel columns of the eight flags of section 07, in the order of the list (Z to AG). */
const FLAG_LETTERS = ['Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG'];
/** The column of a treatment's flag: what its save carries. */
const flagLetterOf = (name: string): string => defined(FLAG_LETTERS[ALL_TREATMENTS.indexOf(name)]);
/** What the eight saves of AC-2 leave in the part: the eight flags of section 07 (Z to AG), each as 1, the way AC-1 reads a chosen one back. */
const EVERY_TREATMENT_STORED: Record<string, string> = Object.fromEntries(FLAG_LETTERS.map((letter) => [idOf(letter), '1']));
const OTHER_REQUIRED = 'Enter the treatment or colour.';

const region = (page: Page, name: string): Locator => page.getByRole('region', { name });
const trigger = (page: Page): Locator =>partForm(page).getByRole('button', { name: /^Surface treatments/ });
const list = (page: Page): Locator => page.getByRole('dialog', { name: 'Surface treatments' });
const otherBox = (page: Page): Locator => partForm(page).getByRole('textbox', { name: 'Other treatment or colour' });

async function openList(page: Page): Promise<void> {
  await trigger(page).click();
  await expect(list(page)).toBeVisible();
}

async function toggle(page: Page, name: string): Promise<void> {
  const saved = nextSave(page, flagLetterOf(name));
  await list(page).getByRole('checkbox', { name: new RegExp(`${name}$`) }).click();
  expect(await saved).toBe(200);
  // The next choice, of the same treatment or another, is made after the page has handled this answer, as a person's is (AQP-1 issue 513).
  await expectNothingUnsaved(page);
}

async function optionNamesOfG(page: Page): Promise<string[]> {
  return control(page, 'G').locator('option').allTextContents();
}

/** The list is read after the form is on the page: until it arrives it holds the empty choice only, then also "Not applicable" and "Other" at least. */
async function treatmentsLoaded(page: Page): Promise<void> {
  await expect.poll(async () => (await optionNamesOfG(page)).length).toBeGreaterThan(2);
}

/**
 * The form of a new Engineer whose part already holds all eight treatments, as `openForm` opens it (the customer through the route the drop-down calls, the page loaded once) with the eight
 * flags written to the part before the page loads, so the page opens on them. For the axe test of AC-2, whose subject is the page in that state and not the eight saves: those are AC-2's other
 * test, and the first test of AC-1 judges the list and what one save stores. The part has the person's ID, like its estimate (the recipe of the scan).
 */
async function openFormWithEveryTreatmentStored(page: Page, testInfo: TestInfo): Promise<void> {
  await ensureCanaryCustomers();
  await ensureCanaryMaterials();
  const owner = await signInAsNewEngineer(page, testInfo);
  await setCanaryCustomer(owner.id, defined(CUSTOMER_CANARIES[0]).id);
  const client = await connectToTestDatabase();
  try {
    await client.query('UPDATE estimate_nodes SET inputs = inputs || $2::jsonb WHERE id = $1::uuid', [owner.id, JSON.stringify(EVERY_TREATMENT_STORED)]);
  } finally {
    await client.end();
  }
  await page.goto(`/estimates/${canaryTaskCodeFor(owner.id)}`);
  await waitForForm(page);
}

test.describe('AC-1, AC-2: the eight surface treatments as one multi-select', () => {
  test('AC-1: the list has the eight, each with its letter; a chosen one is stored as 1 and one that is left as 0; none chosen is valid; the trigger says which, and a reload keeps it', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    await expect(trigger(page)).toContainText('None selected');
    await expect(trigger(page)).toHaveAccessibleName('Surface treatments None selected');
    await openList(page);
    const boxes = list(page).getByRole('checkbox');
    await expect(boxes).toHaveCount(8);
    for (const [index, name] of ALL_TREATMENTS.entries()) await expect(boxes.nth(index)).toHaveAccessibleName(new RegExp(`^Excel column [A-Z]+\\s+${name}$`));
    // Nothing was typed, and nothing is stored.
    expect(await readPartInputs(owner.id)).toEqual({});

    // One treatment is the subject here: chosen it is stored as 1, left again it is stored as 0, and none chosen is valid. A second treatment, chosen and left again, was two more saves (DEF-070:
    // the case ran 12 to 28 s on CI) for claims that are AC-2's: several chosen at once, the names in the order of the list and not of the clicks, each stored as 1.
    await toggle(page, 'Foam');
    await expect(trigger(page)).toContainText('1 selected: Foam');
    expect(await readPartInputs(owner.id)).toEqual({ [FOAM]: '1' });

    await toggle(page, 'Foam');
    await expect(trigger(page)).toContainText('None selected');
    expect(await readPartInputs(owner.id)).toEqual({ [FOAM]: '0' });

    await toggle(page, 'Foam');
    await page.keyboard.press('Escape');
    await page.reload();
    // The reload is a new page load: the form is built from the fields the page fetches once it is up, so the trigger is not on the page until the form is (DEF-070: it was absent when the test's
    // 30 s ran out). Wait for the form as the other part-form specs do after a reload, so the next line judges what the form shows and not whether the form has arrived.
    await waitForForm(page);
    await expect(trigger(page)).toContainText('1 selected: Foam');
  });

  test('AC-2: the keyboard operates it: Space opens, the arrows move between the choices, Space chooses, Escape closes and the focus returns to the button', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    await trigger(page).focus();
    await page.keyboard.press('Space');
    await expect(list(page)).toBeVisible();
    const boxes = list(page).getByRole('checkbox');
    await expect(boxes.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(boxes.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(boxes.first()).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(boxes.last()).toBeFocused();

    await page.keyboard.press('ArrowUp');
    await expect(boxes.nth(6)).toBeFocused();
    const saved = nextSave(page, 'AF');
    await page.keyboard.press('Space');
    expect(await saved).toBe(200);
    await expect(boxes.nth(6)).toBeChecked();
    expect(await readPartInputs(owner.id)).toEqual({ [FOAM]: '1' });

    await page.keyboard.press('Escape');
    await expect(list(page)).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
    await expect(trigger(page)).toContainText('1 selected: Foam');
  });
});

test.describe('AC-3, AC-4, AC-5: Treatment / Color', () => {
  test('AC-3: the options are the names only, with "Other" last and "Not applicable" present, and the hint of the registry is under the field', async ({ page }, testInfo) => {
    const name = newTreatmentName(testInfo, 'list');
    await insertTreatment(name);
    await openForm(page, testInfo);
    await treatmentsLoaded(page);
    const names = await optionNamesOfG(page);
    expect(names[0]).toBe('Choose a treatment or colour');
    expect(names).toContain(name);
    expect(names).toContain('Not applicable');
    expect(names.at(-1)).toBe('Other');
    await expect(control(page, 'G')).toHaveAccessibleDescription("Choose 'Not applicable' if this row has no treatment or colour");
    await expect(otherBox(page)).toHaveCount(0);
  });

  test('AC-4: a listed treatment is saved at once as { id, text } with the name of its row; the page shows it after a reload', async ({ page }, testInfo) => {
    const name = newTreatmentName(testInfo, 'pick');
    const id = await insertTreatment(name);
    const owner = await openForm(page, testInfo);
    await treatmentsLoaded(page);
    const saved = nextSave(page, 'G');
    await control(page, 'G').selectOption({ label: name });
    expect(await saved).toBe(200);
    expect((await readPartInputs(owner.id))[G]).toEqual({ id, text: name });
    await expect(partForm(page).getByText('Choose a treatment or colour.')).toHaveCount(0);
    await page.reload();
    await treatmentsLoaded(page);
    await expect(control(page, 'G').locator('option:checked')).toHaveText(name);
    await expect(region(page, '01 Part Details')).toContainText('1 of 4 complete');
  });

  test('AC-3, AC-4: "Other" shows a box that takes the focus; left empty it says so and stores nothing; with words (trimmed, up to 100 characters) it is stored as { id, text }', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    await treatmentsLoaded(page);
    await control(page, 'G').selectOption({ label: 'Other' });
    await expect(otherBox(page)).toBeFocused();
    await expect(otherBox(page)).toHaveAttribute('maxlength', '100');
    // The box is not told it is empty the moment it appears; it is told when it is left.
    await expect(partForm(page).getByText(OTHER_REQUIRED)).toHaveCount(0);
    await otherBox(page).blur();
    await expect(partForm(page).getByText(OTHER_REQUIRED)).toBeVisible();
    expect((await readPartInputs(owner.id))[G]).toBeUndefined();

    await otherBox(page).fill('  Invented matt black  ');
    const saved = nextSave(page, 'G');
    await otherBox(page).blur();
    expect(await saved).toBe(200);
    await expect(partForm(page).getByText(OTHER_REQUIRED)).toHaveCount(0);
    expect((await readPartInputs(owner.id))[G]).toEqual({ id: OTHER_ID, text: 'Invented matt black' });

    // The box stops at 100 characters (typed one key at a time: a programmatic fill does not meet the attribute).
    await otherBox(page).fill('');
    await otherBox(page).pressSequentially('x'.repeat(150));
    await expect(otherBox(page)).toHaveValue('x'.repeat(100));
  });

  test('AC-4, AC-5 (FR-018): "Not applicable" is stored with its own words and shown on the part for an Engineer, a Lead and an Admin alike, with no rate and no list entry', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    await treatmentsLoaded(page);
    const saved = nextSave(page, 'G');
    await control(page, 'G').selectOption({ label: 'Not applicable' });
    expect(await saved).toBe(200);
    expect((await readPartInputs(owner.id))[G]).toEqual({ id: NOT_APPLICABLE_ID, text: 'Not applicable' });
    await expect(control(page, 'G').locator('option:checked')).toHaveText('Not applicable');
    const part = await page.request.get(`/api/v1/estimates/${owner.id}/nodes/${owner.id}`);
    expect(part.status()).toBe(200);
    const entries = ((await part.json()) as { inputs: Array<{ fieldId: string; value: string }> }).inputs;
    expect(JSON.parse(entries.find((entry) => entry.fieldId === G)?.value ?? 'null')).toEqual({ id: NOT_APPLICABLE_ID, text: 'Not applicable' });
  });

  test('AC-4 (architecture section 5.1): a rename changes no part; a delete leaves the part its words; choosing a deleted ID is refused; and the part shows the words as "(no longer listed)" (AC-6)', async ({ page }, testInfo) => {
    const kept = newTreatmentName(testInfo, 'renamed');
    const gone = newTreatmentName(testInfo, 'gone');
    const keptId = await insertTreatment(kept);
    const goneId = await insertTreatment(gone);
    const owner = await openForm(page, testInfo);
    await treatmentsLoaded(page);
    const saved = nextSave(page, 'G');
    await control(page, 'G').selectOption({ label: kept });
    expect(await saved).toBe(200);

    await renameTreatment(keptId, `${kept}-renamed`);
    expect((await readPartInputs(owner.id))[G]).toEqual({ id: keptId, text: kept });

    await storeTreatmentInPart(owner.id, G, { id: goneId, text: gone });
    await deleteTreatment(goneId);
    await page.reload();
    await treatmentsLoaded(page);
    await expect(control(page, 'G').locator('option:checked')).toHaveText(`${gone} (no longer listed)`);
    expect((await readPartInputs(owner.id))[G]).toEqual({ id: goneId, text: gone });

    // Saving the part without touching Treatment / Color keeps the words.
    const savedLength = nextSave(page, 'J');
    await control(page, 'J').fill('120');
    await control(page, 'J').blur();
    expect(await savedLength).toBe(200);
    expect((await readPartInputs(owner.id))[G]).toEqual({ id: goneId, text: gone });

    // Asking for the deleted ID again, as a stale page would, is refused under G and nothing is stored.
    const refused = await page.request.get(`/api/v1/estimates/${owner.id}/nodes/${owner.id}`);
    const revision = ((await refused.json()) as { revision: number }).revision;
    const answer = await page.request.patch(`/api/v1/estimates/${owner.id}/nodes/${owner.id}/inputs`, {
      headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' },
      data: { revision, values: { [G]: JSON.stringify({ id: '00000000-0000-4000-8000-000700000fff', text: 'x' }) } },
    });
    expect(answer.status()).toBe(422);
    expect((await readPartInputs(owner.id))[G]).toEqual({ id: goneId, text: gone });
  });

  test('AC-7 (NFR-002): the options answer carries an ID and a name and nothing else, and the form names no list of treatments and no rate', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const options = await page.request.get('/api/v1/options/treatments');
    expect(options.status()).toBe(200);
    const body = (await options.json()) as { options: Array<Record<string, unknown>> };
    expect(body.options.length).toBeGreaterThan(1);
    for (const option of body.options) expect(Object.keys(option).sort()).toEqual(['id', 'name']);
    expect(await partForm(page).innerText()).not.toMatch(/rate|price|formula/i);
  });
});

// DEF-048 (AQP-377): AC-8 was one test with three whole-form axe scans. Measured on CI (run 44567048767): the form takes 6 to 9 s to open on the development server (sign-in,
// the customer, the page load, the materials and the treatments) and each whole-form scan takes 2.2 to 3.4 s, so the one test took 15 to 19 s on a quiet runner and ran out of
// its 30 s on a busy one. It is now one test per state of the form, each with its own scan and every check the one test had. A scan is never shortened: the same rules and tags.
test.describe('AC-8: the screen at 360, 768 and 1366 px', () => {
  test('AC-8 (closed): no sideways scroll, axe finds nothing, and the trigger and the field are 44 px high', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await treatmentsLoaded(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectFormAccessible(page);
    expect((await trigger(page).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    expect((await control(page, 'G').boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(await leastFieldHeight(page));
  });

  test('AC-8 (list open): every checkbox is 44 px, there is no sideways scroll, axe finds nothing, and Escape closes the list', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await treatmentsLoaded(page);
    await openList(page);
    for (const box of await list(page).getByRole('checkbox').all()) {
      const size = await box.boundingBox();
      expect(size?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
      expect(size?.width ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect(list(page)).toHaveCount(0);
  });

  test('AC-8 ("Other" showing): the box is 44 px high, there is no sideways scroll and axe finds nothing', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await treatmentsLoaded(page);
    // "Other" last in the original order: leaving its empty box shows a message and moves the cards below, so nothing is pressed after it.
    await control(page, 'G').selectOption({ label: 'Other' });
    expect((await otherBox(page).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(await leastFieldHeight(page));
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectFormAccessible(page);
  });

  // DEF-049 (AQP-378): AC-2 was one test with eight saves, the form open and one whole-form scan, 15.9 to 17.5 s on a quiet runner (run 44737067927) and 25.3 to 29.4 s on a busy one (runs 44580739670 and
  // 44509175744). It is now two. The eight saves are its subject and stay real saves, one request each, in the first test, which has every other check the one test had but the scan. The scan is the
  // second test, on a part that holds what those saves leave (the first test reads it back and the trigger of the second names all eight before the scan), so the scan test does not repeat the saves.
  test('AC-2: with every treatment chosen the trigger shows every name as text and the page still does not scroll sideways', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    await openList(page);
    // Chosen from the last to the first, so the names in the trigger are shown in the order of the list and not of the clicks (AC-1 chooses one treatment only).
    for (const name of [...ALL_TREATMENTS].reverse()) await toggle(page, name);
    await page.keyboard.press('Escape');
    await expect(trigger(page)).toContainText(`8 selected: ${ALL_TREATMENTS.join(', ')}`);
    expect(await readPartInputs(owner.id)).toEqual(EVERY_TREATMENT_STORED);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('AC-2 (axe): with every treatment chosen, as the eight saves leave them, axe finds nothing', async ({ page }, testInfo) => {
    await openFormWithEveryTreatmentStored(page, testInfo);
    // The page is judged as the eight saves leave it: the trigger names all eight.
    await expect(trigger(page)).toContainText(`8 selected: ${ALL_TREATMENTS.join(', ')}`);
    await expectFormAccessible(page);
  });
});
