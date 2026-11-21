import { expect, test } from '@playwright/test';

import { signInAs } from '../e2e/support/calculated-estimate';
import { useFreshAddress } from '../e2e/support/auth';
import { horizontalOverflow } from '../e2e/support/design-system';

import { OTHER_SIZES, SWEEP_ROWS } from './screens-table';
import { loadSweepData, pathOf, personaOf, titleOf, waitUntilSettled } from './support/sweep';

/**
 * STORY-10.08 AC-5 (NFR-016; test strategy section 9): the no-sideways-scroll check at the other sizes, 1024x768, 1920x1080 and 360x800 turned on its side (800x360; 768x1024 turned is
 * 1024x768), for every page of the sweep's table as the first role that may open it. The page is loaded again at each size, so the layout is the one a person on that screen gets and not a
 * resized one. One test per page and role; each size is a soft check, so a failure names every size that scrolls and not only the first.
 */

test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

for (const row of SWEEP_ROWS) {
  const role = row.roles[0];
  if (role === undefined) continue;
  test(`${titleOf(row, role)}: no sideways scroll at the other sizes`, async ({ page }) => {
    const data = loadSweepData();
    const path = pathOf(row, data);
    await signInAs(page, personaOf(role, data));
    for (const size of OTHER_SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      const response = await page.goto(path);
      expect(response?.status(), `the status of ${path} as ${role} at ${size.name}`).toBe(200);
      await expect(page.getByRole('heading', { level: 1 }).first(), `${path} has a heading at ${size.name}`).toBeVisible();
      if (row.readyCss !== undefined) await expect(page.locator(`${row.readyCss}:visible`).first(), `${path} has loaded at ${size.name}`).toBeVisible();
      await waitUntilSettled(page);
      expect.soft(await horizontalOverflow(page), `the page scrolls sideways at ${size.name} on ${path} as ${role}`).toBeLessThanOrEqual(0);
    }
  });
}
