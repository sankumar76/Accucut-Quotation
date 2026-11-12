import { test } from '@playwright/test';

/**
 * THROWAWAY negative control B for AQP-276 (AC-3). It lives on a throwaway pull request that is closed unmerged, never on
 * the story branch (DL-091, DL-105). The file sorts last in the list, so Playwright's own `--shard=4/4` puts the desktop
 * instances in shard 4. They wait in a serial group (eight times 25 s, no timeout widened), so shard 4 is still in its E2E
 * step when shards 1 to 3 and `Stages 1 to 11b` have finished and the run can be cancelled with only shard 4 running.
 * The mobile and tablet instances return at once.
 */
test.describe.configure({ mode: 'serial' });

for (let step = 1; step <= 8; step += 1) {
  test(`control: wait ${step} of 8 (desktop only)`, async () => {
    if (test.info().project.name !== 'desktop') return;
    await new Promise((resolve) => setTimeout(resolve, 25_000));
  });
}
