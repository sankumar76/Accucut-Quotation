import { expect, test } from '@playwright/test';

import { signInAs } from '../e2e/support/calculated-estimate';
import { useFreshAddress } from '../e2e/support/auth';
import { expectNoAxeViolations } from '../e2e/support/design-system';

import { SWEEP_ROWS } from './screens-table';
import { expectNoSidewaysScroll, expectReachable, loadSweepData, pathOf, personaOf, titleOf, waitUntilSettled } from './support/sweep';

/**
 * STORY-10.08 AC-1 and AC-2 (NFR-016, NFR-018; SPEC section 14 item 13): the sweep. Every implemented page of the route manifest (`screens-table.ts` names them, and
 * `tests/unit/sweep-covers-manifest.test.ts` fails when a page is in neither the table nor its exempt list) is opened as every role that may open it, at the project's width
 * (360x800, 768x1024 and 1366x768, the three `chromium-*` projects). Each test checks, in this order:
 *   1. the page answers 200 with a heading, and is not the "no access" card;
 *   2. the page does not scroll sideways (`scrollWidth` is not more than `clientWidth`);
 *   3. each declared primary action scrolls into view and is not covered by a sticky bar;
 *   4. axe finds no violation under the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa` (the existing helper, which waits for transitions to end).
 * The page, the role and the width are in the test's name and project; the rule and the element are in axe's failure. The pages that a role may not open are `no-access.spec.ts`.
 * Every person is invented, and each test signs in on a client address of its own so no test counts against another's sign-in limit.
 */

test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const NO_ACCESS_HEADING = 'You do not have access to this page';

for (const row of SWEEP_ROWS) {
  for (const role of row.roles) {
    test(titleOf(row, role), async ({ page }, testInfo) => {
      const data = loadSweepData();
      const path = pathOf(row, data);
      const where = `${path} as ${role} at ${testInfo.project.name}`;
      await signInAs(page, personaOf(role, data));

      const response = await page.goto(path);
      expect(response?.status(), `the status of ${where}`).toBe(200);
      const heading = page.getByRole('heading', { level: 1 }).first();
      await expect(heading, `${where} has a heading`).toBeVisible();
      await expect(heading, `${where} is not the "no access" card`).not.toHaveText(NO_ACCESS_HEADING);
      if (row.readyCss !== undefined) await expect(page.locator(`${row.readyCss}:visible`).first(), `${where} has loaded its list or form`).toBeVisible();
      await waitUntilSettled(page);

      await expectNoSidewaysScroll(page, where);
      for (const action of row.primary) await expectReachable(page, action);
      // Scrolled to a primary action, the page is not at the top any more; the scan is of the whole page whatever the scroll (axe reads the layout, so it starts from the top as the form specs do).
      await page.evaluate(() => window.scrollTo(0, 0));
      await expectNoAxeViolations(page);
    });
  }
}
