import { expect, test } from '@playwright/test';

import { expectNoAxeViolations, horizontalOverflow } from './support/design-system';
import { makeCustomer, newCustomerName, openCustomers } from './support/customers';
import { ADMIN_STATE } from './support/servers';

/**
 * QA control for Q-12 (DL-202 (9)(d)): SCR-12 Customers "No customer matches" with a 100-character search with no break point, early evidence
 * on master e76b513 plus the two commits of PR 361 (H1 and H2, cherry-picked). Not for merge. Each test sets its own viewport.
 * Output lines start with "QA289Q12". Invented data only.
 */

test.use({ storageState: ADMIN_STATE });

const WIDTHS = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
] as const;
const QUERY = 'W'.repeat(100);
const MIN_LINES = 3;

/** Evidence for the job log; a QA control only, so the console rule is lifted for this one line. */
function note(line: string): void {
  // eslint-disable-next-line no-console
  console.log(line);
}

for (const size of WIDTHS) {
  test.describe(`Q-12 long search at ${size.width} px`, () => {
    test.use({ viewport: size });

    test(`SCR-12 Customers "No customer matches" (${size.width} px)`, async ({ page }, testInfo) => {
      await makeCustomer(page, newCustomerName(testInfo));
      await openCustomers(page);
      await page.getByLabel('Search').fill(QUERY);
      const title = page.getByRole('heading', { name: `No customer matches "${QUERY}"` });
      await expect(title).toBeVisible();
      const box = await title.boundingBox();
      const lineHeight = await title.evaluate((element) => Number.parseFloat(getComputedStyle(element).lineHeight));
      const text = await title.innerText();
      const lines = Math.round((box?.height ?? 0) / lineHeight);
      const overflow = await horizontalOverflow(page);
      note(`QA289Q12 SCR-12 ${size.width} ${JSON.stringify({ lines, left: box?.x, right: (box?.x ?? 0) + (box?.width ?? 0), overflow })}`);
      expect(text, 'the full search text is shown').toContain(QUERY);
      expect(overflow, 'the page does not scroll sideways').toBeLessThanOrEqual(0);
      expect(box?.x ?? -1, 'the title starts inside the window').toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? Number.POSITIVE_INFINITY), 'the title ends inside the window').toBeLessThanOrEqual(size.width);
      expect(lines, 'the search text itself wrapped (3 or more lines)').toBeGreaterThanOrEqual(MIN_LINES);
      await expectNoAxeViolations(page);
    });
  });
}
