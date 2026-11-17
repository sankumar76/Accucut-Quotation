import { expect, test, type Page, type Response } from '@playwright/test';

import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { defined } from '../support/defined';

import { makeCanaryEstimateCalculable, readCalculatedValues, readEstimateState, useFreshAddress } from './support/auth';
import { horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { ALPHA_MATERIAL, control, expectFormAccessible, isPatchOfInputs, isPhone, NUMBER_RULE, nextSave, openForm, partForm, showTree, tree } from './support/part-form';

/**
 * STORY-05.09 T6 (AC-1, AC-2, AC-6, AC-7, AC-9): Calculate on SCR-05 for an Engineer, at 360x800, 768x1024 and 1366x768 on the development server. Each test signs in as a person of its own with an
 * empty draft estimate and one part and the customer chosen (`support/part-form.ts`). A blocked Calculate shows the summary with each part and field as a link, a triangle in the tree and the
 * words under each blank, and writes nothing; a good one answers exactly {status, message} and turns the page to "Submitted" (read-only inputs, no part actions, a disabled button, no number);
 * a double press is one request; Enter on the last field moves to Calculate and never presses it; the action bar stays at the bottom and never hides a focused field; axe finds 0 violations in
 * each state. The words are the UX spec's and the story's, written out here and not imported, so a changed sentence fails a test. What the database holds is judged in
 * `tests/integration/calc/calculate.test.ts`. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const SENTENCE = 'Cost will be calculated based on the input fields and sent for review/approval.';
const BLOCKED_ONE = 'Nothing was submitted. 1 part has missing inputs.';
const NUMBER_MISSING = 'Enter this value. Use 0 if the part does not need it.';
const CHOICE_MISSING = 'Choose a material.';
const TEXT_MISSING = 'Enter this value.';
const ALPHA_CUSTOMER_ID = defined(CUSTOMER_CANARIES[0]).id;

const calculateButton = (page: Page) => page.locator('#calculate-button');
const summary = (page: Page) => page.getByRole('alert').filter({ hasText: 'Nothing was submitted.' });
const isCalculate = (response: Response): boolean => response.request().method() === 'POST' && /\/api\/v1\/estimates\/[^/]+\/calculate$/.test(new URL(response.url()).pathname);

/** Makes the part of the open workspace complete in the database, and shows the page as the database now has it. */
async function makeComplete(page: Page, ownerId: string): Promise<void> {
  await makeCanaryEstimateCalculable(ownerId, ALPHA_MATERIAL.id, ALPHA_CUSTOMER_ID);
  await page.reload();
  await expect(partForm(page)).toBeVisible();
  await expect(control(page, 'E')).toBeEnabled();
}

/**
 * The page does not scroll sideways. When it does, the failure names where it comes from: the boxes that reach past the right edge, and the boxes that do not clip what overflows them (an
 * element with `overflow: visible` whose content is wider than it is), so the element at fault is in the message and not a bare number.
 */
async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const overflow = await horizontalOverflow(page);
  if (overflow <= 0) return;
  const report = await page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const describe = (element: Element): string =>
      `<${element.tagName.toLowerCase()}${element.id === '' ? '' : `#${element.id}`} class="${String(element.getAttribute('class') ?? '').slice(0, 80)}" right=${Math.round(element.getBoundingClientRect().right)} client=${element.clientWidth} scroll=${element.scrollWidth}>`;
    const all = [...document.querySelectorAll('body *')];
    const past = all.filter((element) => element.getBoundingClientRect().right > limit + 0.5 && element.getBoundingClientRect().width > 2).slice(0, 6).map(describe);
    const leaking = all
      .filter((element) => element.scrollWidth > element.clientWidth + 1 && element.clientWidth > 0 && getComputedStyle(element).overflowX === 'visible')
      .slice(0, 6)
      .map(describe);
    return { limit, html: document.documentElement.scrollWidth, body: document.body.scrollWidth, past, leaking };
  });
  expect(overflow, `the page scrolls ${overflow}px sideways (limit ${report.limit}, html ${report.html}, body ${report.body}). Past the edge: ${report.past.join(' | ')}. Not clipping: ${report.leaking.join(' | ')}`).toBeLessThanOrEqual(0);
}

async function press(page: Page): Promise<Response> {
  // A press before the page has its scripts does nothing (the early tap, DEF-013), so the button is waited for until React has given it its handler.
  await waitUntilHydrated(page, '#calculate-button', 'onClick');
  const answered = page.waitForResponse(isCalculate);
  await calculateButton(page).click();
  return answered;
}

test.describe('AC-1: a blank input blocks, and the page says where', () => {
  test('AC-1: Calculate on an empty part shows "Nothing was submitted" with the part and its fields as links, a triangle in the tree and the words under each blank, and nothing is stored', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    const response = await press(page);
    expect(response.status()).toBe(422);

    await expect(summary(page)).toBeVisible();
    await expect(summary(page)).toContainText(BLOCKED_ONE);
    await expect(summary(page)).toContainText('Part 1');
    // The fields it names are the ones the form needs: Fasteners Qty and Cost are hidden by Fasteners being "None", and Part Model is never needed.
    await expect(summary(page).getByRole('link', { name: /^Length/ })).toBeVisible();
    await expect(summary(page).getByRole('link', { name: /^Material in Drawing/ })).toBeVisible();
    await expect(summary(page)).not.toContainText('Fasteners Qty');
    await expect(summary(page)).not.toContainText('Part Model');
    // The summary takes the focus (the button that was pressed is at the bottom of the page).
    await expect(page.locator('[data-calculate-summary]')).toBeFocused();

    // The part's triangle (spoken as words) and the words under each blank.
    // On a phone the tree is in a drawer that stays shut until it is opened.
    await showTree(page);
    await expect(tree(page).getByRole('treeitem').first()).toContainText('Missing inputs');
    if (isPhone(page)) await page.keyboard.press('Escape');
    await expect(partForm(page)).toContainText(NUMBER_MISSING);
    await expect(partForm(page)).toContainText(CHOICE_MISSING);
    await expect(partForm(page)).toContainText(TEXT_MISSING);
    // Review SQR-05 of AQP-317: QTY per Assy is a number, but a part never "needs nothing" of it, so the words under it do not say "Use 0".
    const quantityId = await control(page, 'H').getAttribute('id');
    await expect(page.locator(`#${quantityId ?? 'missing-control'}-error`)).toHaveText(TEXT_MISSING);

    // Nothing was submitted or stored, and the button is there to press again.
    expect(await readEstimateState(owner.id)).toEqual({ status: 'DRAFT', calculations: 0 });
    await expect(page.locator('[data-slot="status-badge"]').first()).toContainText('Draft');
    await expect(calculateButton(page)).toBeEnabled();
  });

  test('AC-1: a link of the summary goes to its field, and filling the field takes its words and its line off the list', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await press(page);
    await summary(page).getByRole('link', { name: /^Length/ }).click();
    await expect(control(page, 'J')).toBeFocused();

    const saved = nextSave(page);
    await control(page, 'J').fill('200');
    await control(page, 'J').blur();
    expect(await saved).toBe(200);
    await expect(summary(page).getByRole('link', { name: /^Length/ })).toHaveCount(0);
    // The words under the field go as soon as there is a value.
    const controlId = await control(page, 'J').getAttribute('id');
    await expect(page.locator(`#${controlId ?? 'missing-control'}-error`)).toHaveCount(0);
  });

  test('AC-1: Fasteners that is not "None" needs its Qty and Cost, which the summary then names', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    await makeComplete(page, owner.id);
    const saved = nextSave(page);
    await control(page, 'S').fill('Invented bolts');
    await control(page, 'S').blur();
    expect(await saved).toBe(200);
    const response = await press(page);
    expect(response.status()).toBe(422);
    await expect(summary(page)).toContainText('Fasteners Qty');
    await expect(summary(page)).toContainText('Fasteners Cost');
    expect(await readEstimateState(owner.id)).toEqual({ status: 'DRAFT', calculations: 0 });
  });
});

test.describe('AC-2, AC-6: a complete estimate is submitted, and the page shows a status and a sentence', () => {
  test('AC-2: Calculate answers exactly {status, message}, the page turns to "Submitted": read-only inputs, no part actions, a disabled button, the one sentence and no number', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    await makeComplete(page, owner.id);
    if (!isPhone(page)) await expect(page.getByRole('button', { name: 'New item' })).toBeVisible();

    const response = await press(page);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: 'SUBMITTED', message: SENTENCE });

    const notice = page.locator('[data-calculate-submitted]');
    await expect(notice).toBeFocused();
    await expect(notice).toContainText(SENTENCE);
    await expect(page.locator('[data-slot="status-badge"]').first()).toContainText('Submitted');
    await expect(calculateButton(page)).toBeDisabled();
    await expect(calculateButton(page)).toHaveText('Submitted');
    await expect(control(page, 'J')).toHaveAttribute('readonly', '');
    for (const name of ['New item', 'Sub-part', 'Part beside', 'Move up', 'Move down', 'Delete']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);

    expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });
    // The page has no calculated figure: the notice holds the sentence and nothing else, and the answer holds no digit.
    expect((await notice.innerText()).replace(/\s+/g, ' ').trim()).toBe(`Submitted ${SENTENCE}`);
    expect(JSON.stringify(await response.json())).not.toMatch(/\d/);

    // After a reload the page is still "Submitted", with the same sentence.
    await page.reload();
    await expect(page.locator('[data-calculate-submitted]')).toContainText(SENTENCE);
    await expect(calculateButton(page)).toBeDisabled();
  });

  test('AC-7: a double press is one request, and a repeated call from the browser is the 409 that makes no second calculation', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    await makeComplete(page, owner.id);
    let posts = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith(`/api/v1/estimates/${owner.id}/calculate`)) posts += 1;
    });
    await calculateButton(page).dblclick();
    await expect(calculateButton(page)).toHaveText('Submitted');
    expect(posts).toBe(1);

    const again = await page.evaluate(async (id) => {
      const answered = await fetch(`/api/v1/estimates/${id}/calculate`, { method: 'POST' });
      return { status: answered.status, body: (await answered.json()) as { code?: string } };
    }, owner.id);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ESTIMATE_ALREADY_SUBMITTED');
    expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });
  });
});

test.describe('AC-2: Calculate sends what the screen shows (review SQR-01 of AQP-317)', () => {
  const countPosts = (page: Page, estimateId: string): { readonly count: () => number } => {
    let posts = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith(`/api/v1/estimates/${estimateId}/calculate`)) posts += 1;
    });
    return { count: () => posts };
  };

  test('AC-2: a value typed just before the press is saved first: the press waits ("Calculating"), sends nothing until the save has been answered, and the record holds the typed value', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    await makeComplete(page, owner.id);
    const posts = countPosts(page, owner.id);
    // The save of the field is held at the server's door until the test lets it go, so the press certainly arrives while the save is in flight.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      (url) => isPatchOfInputs(url.toString(), 'PATCH'),
      async (route) => {
        if (route.request().method() === 'PATCH') await held;
        await route.continue();
      },
    );

    await control(page, 'J').fill('4321.5');
    // The click leaves the field (its save is queued) and presses at once.
    await waitUntilHydrated(page, '#calculate-button', 'onClick');
    await calculateButton(page).click();
    await expect(calculateButton(page)).toContainText('Calculating');
    // A beat for a press that went out too early to show itself: nothing is sent while the save is held.
    await page.waitForTimeout(400);
    expect(posts.count()).toBe(0);

    const answered = page.waitForResponse(isCalculate);
    release();
    expect((await answered).status()).toBe(200);
    await expect(calculateButton(page)).toHaveText('Submitted');
    expect(posts.count()).toBe(1);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });
    // What the immutable record holds is what the Engineer typed, not the value the part held before.
    expect(JSON.stringify((await readCalculatedValues(owner.id)).typed)).toMatch(/4321\.5/);
  });

  test('AC-2: nothing is sent while a field shows a value that is not saved: the page says so, the field says why, and fixing the field lets the next press go', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    await makeComplete(page, owner.id);
    const posts = countPosts(page, owner.id);

    await control(page, 'J').fill('abc');
    await waitUntilHydrated(page, '#calculate-button', 'onClick');
    await calculateButton(page).click();
    await expect(page.getByText('Nothing was submitted. A field has a value that is not saved.')).toBeVisible();
    await expect(partForm(page)).toContainText(NUMBER_RULE);
    await expect(calculateButton(page)).toBeEnabled();
    expect(posts.count()).toBe(0);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'DRAFT', calculations: 0 });

    const saved = nextSave(page);
    await control(page, 'J').fill('200');
    await control(page, 'J').blur();
    expect(await saved).toBe(200);
    const response = await press(page);
    expect(response.status()).toBe(200);
    await expect(page.getByText('Nothing was submitted. A field has a value that is not saved.')).toHaveCount(0);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });
  });
});

test.describe('AC-9: keyboard, sticky bar, width and accessibility', () => {
  test('AC-9: Enter on the last field moves focus to Calculate and does not press it', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    let posts = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/calculate')) posts += 1;
    });
    await control(page, 'AJ').focus();
    await page.keyboard.press('Enter');
    await expect(calculateButton(page)).toBeFocused();
    expect(posts).toBe(0);
    // Enter on the button itself is the press.
    await page.keyboard.press('Enter');
    await expect(summary(page)).toBeVisible();
    expect(posts).toBe(1);
  });

  test('AC-9: the action bar stays at the bottom edge, and a focused field is never hidden behind it', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const bar = page.locator('[data-calculate-bar]');
    await expect(bar).toBeInViewport();
    // The page keeps a focused field clear of the bar with `scroll-padding-bottom: var(--sticky-bottom)`, which a client effect publishes on <html> after the bar is measured (`use-sticky-offsets.ts`). A focus before that
    // scrolls the field to the edge, behind the bar: the failure of AQP-340's run 44048490092, on both attempts. Like DEF-011, the wait is for the page to be ready, not for time.
    await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--sticky-bottom') !== '');
    await control(page, 'AJ').focus();
    await expect(bar).toBeInViewport();
    const field = await control(page, 'AJ').boundingBox();
    const barBox = await bar.boundingBox();
    expect(field && barBox ? field.y + field.height <= barBox.y + 1 : false, 'the focused field ends above the action bar').toBe(true);
    await expectNoSidewaysScroll(page);
  });

  // One test for each state (AQP-340, DEF-037). The two states were one test that opened the form, scanned, reloaded, pressed again and scanned again: 26 to 30 s of the 30 s a test has on a loaded
  // runner (traces: 19 to 30 s), so it was the first to time out when the runner slowed. Each test now holds half of that, with the same assertions and the same scans.
  test('AC-9: axe finds 0 violations in the blocked state, and the page does not scroll sideways', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await press(page);
    await expect(summary(page)).toBeVisible();
    await expectFormAccessible(page);
    await expectNoSidewaysScroll(page);
  });

  test('AC-9: axe finds 0 violations in the submitted state, and the page does not scroll sideways', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    await makeComplete(page, owner.id);
    const response = await press(page);
    expect(response.status()).toBe(200);
    await expect(calculateButton(page)).toHaveText('Submitted');
    await expectFormAccessible(page);
    await expectNoSidewaysScroll(page);
  });
});
