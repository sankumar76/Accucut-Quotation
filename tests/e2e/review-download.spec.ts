import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { saveCanaryQuantity, useFreshAddress } from './support/auth';
import { calculateWithoutThePage, engineerWithEstimate, signInAsLead } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow } from './support/design-system';
import { withExportTurn } from './support/export-slot';

/**
 * STORY-07.07 (AC-1, AC-3, AC-5, AC-6; FR-070; UX spec SCR-06 "Download opens SCR-10"), at 360x800, 768x1024 and 1366x768: on the estimate review of a calculated estimate **Download .xlsx is a link to SCR-10**,
 * drawn as the other buttons of the action bar, and the file card there downloads the file named after the customer, the task and the IST date. Each test opens the review once (the Engineer's Calculate is made
 * without the pages, the recipe of `export.spec.ts`), and the disabled states of the button are `estimate-cleared.spec.ts`, `estimate-review.spec.ts` and `export-refusal.spec.ts`. Every name is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const PHONE_MAX = 767;
const FILE_NAME = /^[^\s/\\:*?"<>|]+_\d{2}-\d{2}-\d{4}\.xlsx$/u;
/** Any other count than the one the part holds, so the input really changes and the figures are cleared (the recipe of `export-refusal.spec.ts`). */
const CHANGED_COUNT = '7';
const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1_000) <= PHONE_MAX;
const reviewDownload = (page: Page): Locator => page.getByRole('link', { name: 'Download .xlsx' });

/** An estimate opened on SCR-06 by a Lead or the Admin: calculated (`current`), never calculated (`none`), or calculated and then changed (`cleared`). */
async function openReview(page: Page, testInfo: TestInfo, role: 'LEAD' | 'ADMIN', figures: 'current' | 'none' | 'cleared' = 'current'): Promise<{ readonly code: string; readonly ownerId: string }> {
  const { owner, code } = await engineerWithEstimate(testInfo);
  if (figures !== 'none') await calculateWithoutThePage(page, owner);
  if (figures === 'cleared') await saveCanaryQuantity(owner.id, CHANGED_COUNT);
  await signInAsLead(page, testInfo, role);
  const response = await page.goto(`/estimates/${code}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(code);
  return { code, ownerId: owner.id };
}

test.describe('AC-1, AC-5: the button on SCR-06 is on while the figures are current', () => {
  test('it is a link named Download .xlsx to SCR-10, with no reason and no "not available yet"', async ({ page }, testInfo) => {
    const { code } = await openReview(page, testInfo, 'LEAD');

    const link = reviewDownload(page);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', `/estimates/${code}/export`);
    await expect(link).not.toHaveAttribute('aria-describedby', /.+/);
    await expect(link).not.toHaveAttribute('aria-disabled', /.+/);
    await expect(page.locator('#review-download-reason')).toHaveCount(0);
    await expect(page.getByText('The Excel download is not available yet.')).toHaveCount(0);
  });

  test('it is the width of the bar buttons (full on a phone, automatic from 768 px), nothing scrolls sideways, and axe finds nothing', async ({ page }, testInfo) => {
    await openReview(page, testInfo, 'LEAD');

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    const barBox = await page.getByRole('group', { name: 'Actions' }).boundingBox();
    const linkBox = await reviewDownload(page).boundingBox();
    expect(barBox).not.toBeNull();
    expect(linkBox).not.toBeNull();
    if (barBox !== null && linkBox !== null) {
      if (isPhone(page)) expect(linkBox.width).toBeGreaterThan(barBox.width * 0.8);
      else expect(linkBox.width).toBeLessThan(barBox.width * 0.5);
    }

    await expectNoAxeViolations(page);
  });

  test('by keyboard: it takes focus with a visible indicator and Enter opens SCR-10', async ({ page }, testInfo) => {
    const { code } = await openReview(page, testInfo, 'LEAD');

    const link = reviewDownload(page);
    await link.focus();
    await expect(link).toBeFocused();
    const focusIndicator = await link.evaluate((element) => {
      const style = getComputedStyle(element);
      return { visible: element.matches(':focus-visible'), drawn: (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || (style.boxShadow !== 'none' && style.boxShadow !== '') };
    });
    expect(focusIndicator).toEqual({ visible: true, drawn: true });

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/estimates/${code}/export$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Excel export');
  });
});

test.describe('AC-2: no link while there is no current calculation', () => {
  for (const figures of ['none', 'cleared'] as const) {
    test(`${figures === 'none' ? 'never calculated' : 'the total cleared by an input change'}: Download stays a disabled button described by its reason, and nothing on the page links to SCR-10`, async ({ page }, testInfo) => {
      await openReview(page, testInfo, 'LEAD', figures);

      const button = page.locator('#review-download');
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute('aria-describedby', 'review-download-reason');
      await expect(page.locator('#review-download-reason')).toHaveText('Calculate or Recalculate first. There is no file until a calculation is current.');
      await expect(page.getByRole('link', { name: 'Download .xlsx' })).toHaveCount(0);
      await expect(page.locator('a[href$="/export"]')).toHaveCount(0);
    });
  }
});

test.describe('AC-3: the figures are cleared after SCR-06 was drawn', () => {
  test('the link still goes to SCR-10, which refuses with its own notice: no file card, no table, no file', async ({ page }, testInfo) => {
    const { code, ownerId } = await openReview(page, testInfo, 'LEAD');
    await saveCanaryQuantity(ownerId, CHANGED_COUNT);

    await reviewDownload(page).click();
    await expect(page).toHaveURL(new RegExp(`/estimates/${code}/export$`));
    await expect(page.getByText('The total is cleared because an input changed.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to the estimate to Recalculate' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download .xlsx' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'The rows in the file' })).toHaveCount(0);
  });
});

test.describe('AC-6: the journey from the review to the file', () => {
  for (const role of ['LEAD', 'ADMIN'] as const) {
    test(`a ${role === 'LEAD' ? 'Lead' : 'Admin'} presses Download on SCR-06, lands on SCR-10, and the file downloads under the customer, task and date name`, async ({ page }, testInfo) => {
      const { code } = await openReview(page, testInfo, role);

      await reviewDownload(page).click();
      await expect(page).toHaveURL(new RegExp(`/estimates/${code}/export$`));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Excel export');

      const [download] = await withExportTurn(() => Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download .xlsx' }).click()]));
      expect(download.suggestedFilename()).toMatch(FILE_NAME);
      expect(download.suggestedFilename()).toContain(`_${code}_`);
    });
  }
});
