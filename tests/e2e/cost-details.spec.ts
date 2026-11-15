import { expect, test, type Page } from '@playwright/test';

import { createDisposableUser, saveCanaryQuantity, useFreshAddress } from './support/auth';
import { calculateAsEngineer, engineerWithEstimate, signInAs, signInAsLead } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow } from './support/design-system';

/**
 * STORY-06.03 (AC-1 to AC-9; NFR-002): the cost details of a row, SCR-07, for a Lead and an Admin at `/estimates/<code>/costs/1`, at 360x800, 768x1024 and 1366x768. Each test makes an Engineer of its own with
 * an estimate (the recipe of the confidentiality scan), has the Engineer calculate it through the portal, and opens the page as a Lead. What it checks: the six panels with each line's tag, name, formula,
 * working and value; that the page only reads (no field, no button that changes anything); the cleared and not-calculated states; that the Engineer gets the fixed 403 from the route and SCR-26 from the
 * page, and sees no link to either; the phone's accordion with only stage 1 open, the side-by-side layout from 1280 px, the keyboard, no sideways scroll and no axe violation. The words are the UX spec's and the
 * story's, written out here and not imported. The figures and the working of the hand-worked row are held by `tests/unit/estimate/cost-working.test.ts` and `tests/unit/cost-details-screen.test.ts` (the
 * canary materials here have prices that no hand repeat of a 4-decimal working could reproduce); the cost scan reads the same page and route as an Engineer and as a Lead (`canary-scan.spec.ts`).
 * Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const PHONE_MAX = 767;
const DESKTOP_MIN = 1280;
const STAGE_TITLES = ['1. Weights & Areas', '2. Material Cost', '3. Process Costs', '4. Sub Total', '5. Rejection, Overheads & Logistics', '6. Pricing'];
const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1_000) <= PHONE_MAX;
const isWide = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= DESKTOP_MIN;
const stage = (page: Page, number: number) => page.locator(`details[data-stage="${number}"]`);

async function openCostDetails(page: Page, code: string, slNo = '1'): Promise<void> {
  const response = await page.goto(`/estimates/${code}/costs/${slNo}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cost details');
}

/** Opens every stage. On a phone the script closes stages 2 to 6 after load, so this waits for that first and then opens what is closed: a line in a closed panel is not visible. */
async function openAllStages(page: Page): Promise<void> {
  if (isPhone(page)) await expect(stage(page, 6)).not.toHaveAttribute('open', '');
  for (const number of [1, 2, 3, 4, 5, 6]) {
    if ((await stage(page, number).getAttribute('open')) === null) await stage(page, number).locator('summary').click();
    await expect(stage(page, number)).toHaveAttribute('open', '');
  }
}

test.describe('AC-1, AC-2: a calculated estimate, as a Lead', () => {
  test('AC-1: six panels with the number and name of each stage, the total in the summary, and each line with its tag, name, formula and working', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    await signInAsLead(page, testInfo);
    await openCostDetails(page, code);

    await expect(page.locator('details[data-stage]')).toHaveCount(6);
    for (const [index, title] of STAGE_TITLES.entries()) await expect(stage(page, index + 1).locator('summary')).toContainText(title);
    await expect(stage(page, 3).locator('summary')).toContainText(/Stage total: [\d,]+\.\d{2}/);
    await openAllStages(page);

    const material = stage(page, 2);
    await expect(material).toContainText('Excel column AK');
    await expect(material.getByText('AK = (M * I) - (O * Material-Scrap-Rate)', { exact: true })).toBeVisible();
    await expect(material.getByText(/^AK = \(.+ × .+\) - \(.+ × .+\) = [\d,]+\.\d{2}$/)).toBeVisible();
    await expect(stage(page, 1).getByText('O = IF(Material-Specific-Gravity > 0, M - N, 0)', { exact: true })).toBeVisible();
    await expect(stage(page, 6).getByText(/^BG = .+ = [\d,]+\.\d{2}$/)).toBeVisible();
    await expect(page.getByText('Unit Production Price', { exact: true }).first()).toBeVisible();
  });

  test('AC-2: a sentence says what the working prints and states the rounding rule', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    await signInAsLead(page, testInfo);
    await openCostDetails(page, code);

    await expect(page.getByText('repeating the arithmetic by hand gives the figure printed or, now and then, a figure a hundredth or two away from it.')).toBeVisible();
    await expect(page.getByText('The portal keeps every digit, adds the unrounded values and rounds once')).toBeVisible();
    await expect(page.getByText(/^Calculated .+ · configuration version \d+$/)).toBeVisible();
  });

  test('AC-6: the page only reads: no field, no button that changes anything, no editable element, and no edit control beside a formula', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    await signInAsLead(page, testInfo);
    await openCostDetails(page, code);

    await expect(page.locator('main').locator('input, textarea, select, form, button, [contenteditable]')).toHaveCount(0);
    await expect(page.getByText('This page only shows the formulas. They cannot be changed here.')).toBeVisible();
    await expect(page.getByRole('button', { name: /edit|save|change formula/i })).toHaveCount(0);
  });

  test('AC-1: an Admin sees the same page, and the review of the estimate links to it from the row', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    await signInAsLead(page, testInfo, 'ADMIN');
    await page.goto(`/estimates/${code}`);
    await page.getByRole('link', { name: /^View cost details for 1/ }).click();
    await expect(page).toHaveURL(new RegExp(`/estimates/${code}/costs/1$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cost details');
    await expect(page.locator('details[data-stage]')).toHaveCount(6);
  });

  test('a part that is not in the estimate, and an address that is no Sl. No, are "not found"', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    await signInAsLead(page, testInfo);
    for (const slNo of ['2', '1.1', 'abc']) expect((await page.goto(`/estimates/${code}/costs/${slNo}`))?.status(), slNo).toBe(404);
    expect((await page.goto('/estimates/Q-1900-0001/costs/1'))?.status()).toBe(404);
  });
});

test.describe('AC-7: the states with nothing current', () => {
  test('not calculated: the row header and the way back stay, and there is no stage', async ({ page }, testInfo) => {
    const { code } = await engineerWithEstimate(testInfo);
    await signInAsLead(page, testInfo);
    await openCostDetails(page, code);

    const notice = page.getByRole('status').filter({ hasText: 'The Engineer has not calculated this estimate yet' });
    await expect(notice).toBeVisible();
    await expect(page.locator('details[data-stage]')).toHaveCount(0);
    await expect(page.getByText('Stage total')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Back to the estimate' })).toBeVisible();
    await expect(notice.getByRole('link', { name: 'Go to the estimate' })).toHaveAttribute('href', `/estimates/${code}`);
  });

  test('cleared: an input changed, so the stages are replaced by "Cleared" (no button named until STORY-06.04), with a link, and the answer of the route holds the state and no value', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    // The same change a save from another tab makes: the count of the part changes and the estimate's input revision goes up (architecture section 4.8).
    await saveCanaryQuantity(owner.id, '7');
    await signInAsLead(page, testInfo);
    await openCostDetails(page, code);

    const notice = page.getByRole('status').filter({ hasText: 'An input changed, so every calculated figure is cleared' });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('An input changed, so every calculated figure is cleared, on every row. The stages show again once the estimate is calculated again.');
    await expect(notice).not.toContainText('Recalculate');
    await expect(notice.getByRole('link', { name: 'Go to the estimate' })).toHaveAttribute('href', `/estimates/${code}`);
    await expect(page.locator('details[data-stage]')).toHaveCount(0);
    await expect(page.getByText('Stage total')).toHaveCount(0);
    await expect(page.getByText('Excel column')).toHaveCount(0);

    const answer = await page.evaluate(async (id) => {
      const response = await fetch(`/api/v1/estimates/${id}/nodes/${id}/costs`);
      return { status: response.status, body: await response.text() };
    }, owner.id);
    expect(answer.status).toBe(200);
    expect(JSON.parse(answer.body)).toEqual({ state: 'out-of-date', row: { nodeId: owner.id, slNo: '1', name: expect.any(String) }, details: null });
    expect(answer.body).not.toMatch(/Material-Scrap-Rate|stages|formula|working/);
  });
});

test.describe('AC-8 (NFR-002): an Engineer gets nothing', () => {
  test('the route is the fixed 403 and the page is "no access" with HTTP 403, before anything is read; the Engineer sees no button or link to either; a Lead gets the answer', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);

    const own = await page.goto(`/estimates/${code}`);
    expect(own?.status()).toBe(200);
    await expect(page.getByText('View cost details')).toHaveCount(0);

    const refused = await page.evaluate(async (id) => {
      const response = await fetch(`/api/v1/estimates/${id}/nodes/${id}/costs`);
      return { status: response.status, body: await response.text() };
    }, owner.id);
    expect(refused.status).toBe(403);
    expect(JSON.parse(refused.body)).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(refused.body).not.toMatch(/state|details|stages|formula|working|Material-Scrap-Rate/);

    const page403 = await page.goto(`/estimates/${code}/costs/1`);
    expect(page403?.status()).toBe(403);
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Cost details');
    await expect(page.locator('details[data-stage]')).toHaveCount(0);

    // Another Engineer, on this one's estimate: still the refusal, and the same for a part that is not there (the answer does not depend on the IDs).
    const other = await createDisposableUser('scan', testInfo);
    await signInAs(page, other);
    expect((await page.goto(`/estimates/${code}/costs/1`))?.status()).toBe(403);
    const foreign = await page.evaluate(async (id) => (await fetch(`/api/v1/estimates/${id}/nodes/${id}/costs`)).status, owner.id);
    expect(foreign).toBe(403);

    await signInAsLead(page, testInfo);
    const allowed = await page.evaluate(async (id) => {
      const response = await fetch(`/api/v1/estimates/${id}/nodes/${id}/costs`);
      return { status: response.status, body: await response.text() };
    }, owner.id);
    expect(allowed.status).toBe(200);
    expect(JSON.parse(allowed.body)).toMatchObject({ state: 'current', details: { stages: expect.any(Array) } });

    await page.context().clearCookies();
    expect((await page.request.get(`/api/v1/estimates/${owner.id}/nodes/${owner.id}/costs`)).status()).toBe(401);
  });
});

test.describe('AC-9: layout and accessibility', () => {
  test('a calculated row: no sideways scroll, only stage 1 open on a phone and every stage open from 768, side by side from 1280, keyboard operable, axe finds nothing', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    await signInAsLead(page, testInfo);
    await openCostDetails(page, code);

    // The script of the phone's accordion runs after load; the assertions wait for it.
    if (isPhone(page)) {
      await expect(stage(page, 1)).toHaveAttribute('open', '');
      for (const number of [2, 3, 4, 5, 6]) await expect(stage(page, number)).not.toHaveAttribute('open', '');
    } else {
      for (const number of [1, 2, 3, 4, 5, 6]) await expect(stage(page, number)).toHaveAttribute('open', '');
    }

    // Layout: the box of the row and the stages are one column below 1280 px and sit side by side from 1280 px.
    const box = page.locator('[data-slot="card"]').filter({ hasText: 'Unit Production Price' }).first();
    const boxRect = await box.boundingBox();
    const stagesRect = await stage(page, 1).boundingBox();
    expect(boxRect).not.toBeNull();
    expect(stagesRect).not.toBeNull();
    if (boxRect !== null && stagesRect !== null) {
      if (isWide(page)) expect(stagesRect.x).toBeGreaterThanOrEqual(boxRect.x + boxRect.width - 1);
      else expect(stagesRect.y).toBeGreaterThanOrEqual(boxRect.y + boxRect.height - 1);
    }

    // The keyboard: a summary takes focus, Enter folds the panel and Enter opens it again.
    const summary = stage(page, 2).locator('summary');
    const wasOpen = (await stage(page, 2).getAttribute('open')) !== null;
    await summary.focus();
    await expect(summary).toBeFocused();
    await page.keyboard.press('Enter');
    if (wasOpen) await expect(stage(page, 2)).not.toHaveAttribute('open', '');
    else await expect(stage(page, 2)).toHaveAttribute('open', '');
    await page.keyboard.press('Enter');
    if (wasOpen) await expect(stage(page, 2)).toHaveAttribute('open', '');
    else await expect(stage(page, 2)).not.toHaveAttribute('open', '');

    // Everything open for the checks that follow, whatever the width: formulas are text, never an image, and wrap.
    for (const number of [1, 2, 3, 4, 5, 6]) {
      if ((await stage(page, number).getAttribute('open')) === null) await stage(page, number).locator('summary').click();
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expect(page.locator('main img, main canvas')).toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  test('cleared and not calculated: no sideways scroll and axe finds nothing', async ({ page }, testInfo) => {
    const { code } = await engineerWithEstimate(testInfo);
    await signInAsLead(page, testInfo);
    await openCostDetails(page, code);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });
});
