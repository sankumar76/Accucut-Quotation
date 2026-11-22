import { test as setup } from '@playwright/test';

import { ensureE2eAdmin, ensureE2eUsers, putPictureOnCanaryPart, useFreshAddress } from '../e2e/support/auth';
import { calculateWithoutThePage, engineerWithEstimate, signInAs } from '../e2e/support/calculated-estimate';

import { SWEEP_ROWS } from './screens-table';
import { pathOf, personaOf, writeSweepData } from './support/sweep';

/**
 * The set-up project of the sweep configuration (STORY-10.08): it makes the invented people (the E2E Lead, the one active E2E Admin), seeds two estimates in the job's own database,
 * saves what the specs need to open them, and asks the production server for every page of the table once.
 *
 *   - `calculated`: an Engineer's estimate that the Engineer has calculated, for the Lead's review, the cost details and the export;
 *   - `draft`: another Engineer's estimate, complete but not calculated, for the form (the Engineer's own screen).
 *
 * The warm-up is for the reason that `playwright.config.ts`'s own set-up gives: `next start` loads a route's module on the route's first request, so the first request of each page is slower
 * than the rest, and four workers would each pay for it inside a test. It asserts nothing: a page that answers badly fails its own test in the sweep, by name, which is the report that is wanted.
 */

const SETUP_TIMEOUT = 180_000;

setup('seed the sweep: the people, a calculated estimate and a draft estimate, then ask for every page once', async ({ page, context }, testInfo) => {
  setup.setTimeout(SETUP_TIMEOUT);
  await ensureE2eUsers();
  await ensureE2eAdmin();
  await useFreshAddress(context);

  const calculated = await engineerWithEstimate(testInfo);
  // The export holds the part's picture (STORY-07.02 AC-4), so it is given before Calculate records it.
  await putPictureOnCanaryPart(calculated.owner.id);
  await calculateWithoutThePage(page, calculated.owner);
  const draft = await engineerWithEstimate(testInfo);

  const data = {
    calculated: { code: calculated.code, ownerEmail: calculated.owner.email },
    draft: { code: draft.code, ownerEmail: draft.owner.email },
  };
  writeSweepData(data);

  for (const role of ['ADMIN', 'LEAD', 'ENGINEER'] as const) {
    await signInAs(page, personaOf(role, data));
    for (const row of SWEEP_ROWS.filter((entry) => entry.roles.includes(role))) {
      // Only a read, so nothing is changed. The answer is not judged here; it goes into the report, so a page that answered badly is easy to find.
      const answer = await page.request.get(pathOf(row, data));
      testInfo.annotations.push({ type: 'warm-up', description: `${answer.status()} ${role} ${row.route}` });
    }
  }
});
