import { expect, test } from '@playwright/test';

import { signInAs } from '../e2e/support/calculated-estimate';
import { useFreshAddress } from '../e2e/support/auth';
import { allowsRole, findPage } from '../../src/server/http/route-manifest';
import type { RoleName } from '../../src/lib/auth/roles';

import { SWEEP_ROWS, type SweepRole } from './screens-table';
import { expectNoSidewaysScroll, loadSweepData, pathOf, personaOf } from './support/sweep';

/**
 * STORY-10.08 AC-1, the second half: a role that the manifest does not allow on a page gets SCR-26 "no access" with status 403, **checked once per page** (this spec runs in the 1366
 * project only, `playwright.sweep.config.ts`). The roles come from the manifest, not from this spec, so a page whose roles change is checked as its new forbidden role. The first
 * forbidden role in the order Engineer, Lead, Admin is used: the Engineer is the person whom BR-003 keeps out of most pages.
 */

test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const ORDER: ReadonlyArray<SweepRole> = ['ENGINEER', 'LEAD', 'ADMIN'];
const NO_ACCESS_HEADING = 'You do not have access to this page';

const firstRowOf = new Map(SWEEP_ROWS.map((row) => [row.route, row]));

for (const [route, row] of firstRowOf) {
  const manifestRow = findPage(route);
  const forbidden = ORDER.find((role: RoleName) => manifestRow !== undefined && !allowsRole(manifestRow, role));
  if (forbidden === undefined) continue;
  test(`SCR-26 No access, ${route}, as ${forbidden}`, async ({ page }, testInfo) => {
    const data = loadSweepData();
    const path = pathOf(row, data);
    const where = `${path} as ${forbidden} at ${testInfo.project.name}`;
    await signInAs(page, personaOf(forbidden, data));

    const response = await page.goto(path);
    expect(response?.status(), `the status of ${where}`).toBe(403);
    await expect(page.getByRole('heading', { level: 1 }).first(), `${where} shows the no-access card`).toHaveText(NO_ACCESS_HEADING);
    await expectNoSidewaysScroll(page, where);
  });
}
