import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';

import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { canaryTaskCodeFor } from '../support/estimate-recipe';
import { defined } from '../support/defined';

import { ensureCanaryCustomers, ensureCanaryMaterials, useFreshAddress } from './support/auth';
import { horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { expectFormAccessible, isPatchOfInputs, leastFieldHeight, partForm, signInAsNewEngineer, waitForForm } from './support/part-form';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-08.08 AC-1, AC-4, AC-8, AC-9 (FR-074; NFR-016 to NFR-018): the part form of SCR-05 draws a **choice input in a new section** the Admin added, at 360x800, 768x1024 and 1366x768 on the development server,
 * for an Engineer: the new card after section 08 with its number, name, column tag and "n of m complete", its link in the strip, the choice as a list with its letter badge, label, hint and options in their
 * stored order, chosen by the keyboard alone (arrow keys, then Enter moves on), saved as the option's text, and the words under it when Calculate found it blank. The words are the UX spec's and the story's,
 * written out here and not imported.
 *
 * **The registry is not changed here.** The three projects share one database, and a real insert would add a mandatory input that every other spec's Calculate would meet (the reason `insert-field.spec.ts`
 * answers its save itself). So the form's answer is read from the real server and **one section is added to it by the test** (a card 09 with one choice field of invented IDs), and the one save and the one
 * Calculate that name that field are answered by the test; everything else goes to the real server. What the server does with a real choice (the stored text, the 422, the record and the file) is
 * `tests/integration/estimates/choice-input.test.ts`, and what it sends an Engineer is `tests/security/engineer-choice-section.test.ts`. Each test has its own person, one page and at most one axe scan.
 * Every name and ID is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const ALPHA_CUSTOMER_ID = defined(CUSTOMER_CANARIES[0]).id;
const SECTION_ID = '00000000-0000-4000-8000-00000000f009';
const FIELD_ID = '00000000-0000-4000-8000-00000000f0a9';
const LABEL = 'Invented Finish Grade';
const HINT = 'Pick the grade on the drawing.';
const OPTIONS = ['Coarse', 'Fine', 'Mirror'] as const;
const PLACEHOLDER = 'Choose an option';
const MISSING = 'Choose an option.';

const choice = (page: Page) => page.locator(`#part-field-${FIELD_ID}`);
const card = (page: Page) => page.getByRole('region', { name: '09 Invented Finishing' });
const strip = (page: Page) => page.getByRole('navigation', { name: 'Sections of the form' });

/** The real form of the server, with one card added by the test: section 09 with a choice field. */
async function answerFormWithChoice(route: Route): Promise<void> {
  const response = await route.fetch();
  const body = (await response.json()) as { sections: unknown[] };
  body.sections.push({
    id: SECTION_ID,
    number: 9,
    name: 'Invented Finishing',
    shortName: 'Finishing',
    columnRange: 'AY',
    fields: [{ id: FIELD_ID, letter: 'AY', label: LABEL, kind: 'input', unit: null, hint: HINT, defaultValue: null, required: true, editable: true, visibleWhen: null, rule: { type: 'choice', options: [...OPTIONS] } }],
  });
  await route.fulfill({ status: response.status(), contentType: 'application/json', body: JSON.stringify(body) });
}

/** A save that names the choice is answered by the test (and recorded); any other save goes to the real server. */
async function answerChoiceSave(page: Page): Promise<{ readonly sent: Array<Record<string, string>> }> {
  const sent: Array<Record<string, string>> = [];
  await page.route('**/api/v1/estimates/*/nodes/*/inputs', async (route) => {
    const request = route.request();
    if (!isPatchOfInputs(request.url(), request.method())) return route.continue();
    const values = (request.postDataJSON() as { values: Record<string, string> }).values;
    if (!(FIELD_ID in values)) return route.continue();
    sent.push(values);
    const part = new URL(request.url()).pathname.split('/')[6] ?? '';
    // The answer lists the part's values as the server does: one `{ fieldId, value }` for each (a body the page cannot read is a failed save, and the card would not count the choice).
    const inputs = Object.entries(values).map(([fieldId, value]) => ({ fieldId, value }));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: part, revision: 2, completeness: 'PARTIAL', inputs }) });
  });
  return { sent };
}

/** Signs in as a person of the test's own, chooses the customer, and opens the form with the card added. */
async function openFormWithChoice(page: Page, testInfo: TestInfo): Promise<{ readonly id: string }> {
  await ensureCanaryCustomers();
  await ensureCanaryMaterials();
  const owner = await signInAsNewEngineer(page, testInfo);
  const chosen = await page.request.put(`/api/v1/estimates/${owner.id}/customer`, { headers: { origin: DEVELOPMENT_URL }, data: { customerId: ALPHA_CUSTOMER_ID } });
  expect(chosen.status(), 'the customer is chosen').toBe(200);
  await page.route('**/api/v1/estimates/*/form', answerFormWithChoice);
  await page.goto(`/estimates/${canaryTaskCodeFor(owner.id)}`);
  await waitForForm(page);
  return owner;
}

test.describe('AC-1, AC-4, AC-9: the new card and the choice', () => {
  test('AC-1, AC-4, AC-9: card 09 comes after 08 with its column tag and count, its link ends the strip, and the choice is a labelled list of the options in order; no sideways scroll, axe 0', async ({ page }, testInfo) => {
    await openFormWithChoice(page, testInfo);
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toContainText('AY');
    await expect(card(page)).toContainText('0 of 1 complete');
    await expect(card(page)).toContainText(HINT);
    // The strip has a link for every card, the new one last, after 08.
    await expect(strip(page).getByRole('link').last()).toHaveText(/^09 Finishing/);
    await expect(strip(page).getByRole('link', { name: /^08 Other/ })).toBeVisible();

    // The choice: a real label with its Excel column first, the placeholder, then the options in the order the Admin gave and no other.
    const list = page.getByRole('combobox', { name: new RegExp(`^Excel column AY\\s+${LABEL}`) });
    await expect(list).toHaveCount(1);
    await expect(list).toBeEnabled();
    expect(await choice(page).locator('option').allTextContents()).toEqual([PLACEHOLDER, ...OPTIONS]);
    expect(defined(await choice(page).boundingBox()).height).toBeGreaterThanOrEqual(await leastFieldHeight(page));

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectFormAccessible(page);
  });

  test('AC-8, AC-9: the choice is made by typing to it, saved as the option text, counted and ticked in the strip; Enter then moves on', async ({ page }, testInfo) => {
    const { sent } = await answerChoiceSave(page);
    await openFormWithChoice(page, testInfo);
    await choice(page).focus();
    // Typing the first letters of an option chooses it with one change (the arrow keys choose by the same control, one option at a time).
    await page.keyboard.type('Mi');
    await expect(choice(page)).toHaveValue('Mirror');
    await expect.poll(() => sent.length).toBe(1);
    // What is saved is the text of the option, by the field's ID.
    expect(sent[0]).toEqual({ [FIELD_ID]: 'Mirror' });
    await expect(card(page)).toContainText('1 of 1 complete');
    await expect(strip(page).getByRole('link', { name: /^09 Finishing\s*All filled in$/ })).toBeVisible();
    // Enter never submits: on the last field of the form it moves to the Calculate button.
    await page.keyboard.press('Enter');
    await expect(page.locator('#calculate-button')).toBeFocused();
  });

  test('AC-3, AC-9: a Calculate that found the choice blank says "Choose an option." under it, and the summary links to it', async ({ page }, testInfo) => {
    const owner = await openFormWithChoice(page, testInfo);
    await page.route('**/api/v1/estimates/*/calculate', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/problem+json',
        body: JSON.stringify({ type: 'about:blank', title: 'Nothing was submitted', status: 422, code: 'CALCULATE_BLOCKED', parts: [{ nodeId: owner.id, slNo: '1', name: null, fields: [{ fieldId: FIELD_ID, label: LABEL }] }] }),
      }),
    );
    await waitUntilHydrated(page, '#calculate-button', 'onClick');
    await page.locator('#calculate-button').click();
    const summary = page.locator('[data-calculate-summary]');
    await expect(summary).toBeVisible();
    await expect(summary.getByRole('link', { name: new RegExp(`^${LABEL}`) })).toBeVisible();
    await expect(partForm(page)).toContainText(MISSING);
    // The words are tied to the control, so a screen reader reads them with the list.
    await expect(choice(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator(`#part-field-${FIELD_ID}-error`)).toHaveText(MISSING);
  });
});
