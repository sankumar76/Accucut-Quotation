import { expect, test } from '@playwright/test';

/**
 * Scaffold smoke test: proves the three screen-size projects run and that the page does not scroll
 * sideways (NFR-016). The real journeys arrive with the page stories (STORY-10.08).
 */

const VIEWPORT_WIDTHS: Readonly<Record<string, number>> = { mobile: 360, tablet: 768, desktop: 1366 };

test('home page loads at this project\'s width without horizontal scroll (NFR-016)', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Accucut Quotation Portal' })).toBeVisible();

  const expectedWidth = VIEWPORT_WIDTHS[testInfo.project.name];
  expect(page.viewportSize()?.width).toBe(expectedWidth);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
