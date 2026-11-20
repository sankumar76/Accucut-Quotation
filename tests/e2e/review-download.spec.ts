import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { calculateWithoutThePage, engineerWithEstimate, signInAsLead } from './support/calculated-estimate';
import { useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow } from './support/design-system';
import { withExportTurn } from './support/export-slot';

/**
 * STORY-07.07 (AC-1, AC-5, AC-6; FR-070; UX spec SCR-06 "Download opens SCR-10"), at 360x800, 768x1024 and 1366x768: on the estimate review of a calculated estimate **Download .xlsx is a link to SCR-10**, drawn as
 * the other buttons of the action bar, and the file card there downloads the file named after the customer, the task and the IST date. Each test opens the review once (the Engineer's Calculate is made without the
 * pages, the recipe of `export.spec.ts`), and the disabled states of the button are `estimate-cleared.spec.ts`, `estimate-review.spec.ts` and `export-refusal.spec.ts`. Every name is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const PHONE_MAX = 767;
const FILE_NAME = /^Quotation_[A-Za-z0-9_-]+_Q-\d{4}-\d{4,}_\d{4}-\d{2}-\d{2}\.xlsx$/;
const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1_000) <= PHONE_MAX;
const reviewDownload = (page: Page): Locator => page.getByRole('link', { name: 'Download .xlsx' });

/** A calculated estimate, opened on SCR-06 by a Lead or the Admin. */
async function openReview(page: Page, testInfo: TestInfo, role: 'LEAD' | 'ADMIN'): Promise<string> {
  const { owner, code } = await engineerWithEstimate(testInfo);
  await calculateWithoutThePage(page, owner);
  await signInAsLead(page, testInfo, role);
  const response = await page.goto(`/estimates/${code}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(code);
  return code;
}

test.describe('AC-1, AC-5: the button on SCR-06 is on while the figures are current', () => {
  test('it is a link named Download .xlsx to SCR-10, with no reason, the width of the bar buttons, no sideways scroll, and axe finds nothing', async ({ page }, testInfo) => {
    const code = await openReview(page, testInfo, 'LEAD');

    const link = reviewDownload(page);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', `/estimates/${code}/export`);
    await expect(link).not.toHaveAttribute('aria-describedby', /.+/);
    await expect(link).not.toHaveAttribute('aria-disabled', /.+/);
    await expect(page.locator('#review-download-reason')).toHaveCount(0);
    await expect(page.getByText('The Excel download is not available yet.')).toHaveCount(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    // Full width at 360 px and automatic width from 768 px, as the other buttons of the bar.
    const bar = page.getByRole('group', { name: 'Actions' });
    const barBox = await bar.boundingBox();
    const linkBox = await link.boundingBox();
    expect(barBox).not.toBeNull();
    expect(linkBox).not.toBeNull();
    if (barBox !== null && linkBox !== null) {
      if (isPhone(page)) expect(linkBox.width).toBeGreaterThan(barBox.width * 0.8);
      else expect(linkBox.width).toBeLessThan(barBox.width * 0.5);
    }

    await expectNoAxeViolations(page);
  });

  test('by keyboard: it takes focus with a visible indicator and Enter opens SCR-10', async ({ page }, testInfo) => {
    const code = await openReview(page, testInfo, 'LEAD');

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

test.describe('AC-6: the journey from the review to the file', () => {
  for (const role of ['LEAD', 'ADMIN'] as const) {
    test(`a ${role === 'LEAD' ? 'Lead' : 'Admin'} presses Download on SCR-06, lands on SCR-10, and the file downloads under the customer, task and date name`, async ({ page }, testInfo) => {
      const code = await openReview(page, testInfo, role);

      await reviewDownload(page).click();
      await expect(page).toHaveURL(new RegExp(`/estimates/${code}/export$`));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Excel export');

      const [download] = await withExportTurn(() => Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download .xlsx' }).click()]));
      expect(download.suggestedFilename()).toMatch(FILE_NAME);
      expect(download.suggestedFilename()).toContain(`_${code}_`);
    });
  }
});
