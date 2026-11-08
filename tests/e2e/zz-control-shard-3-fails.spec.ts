import { expect, test } from '@playwright/test';

/**
 * THROWAWAY negative control for AQP-227 AC-4 (a). It lives on a throwaway pull request that is closed unmerged, never on the
 * story branch (DL-091, DL-105). It fails in the `desktop` project only. The file sorts last in the list, so Playwright's own
 * `--shard=3/3` puts the desktop instance in shard 3, while the mobile and tablet instances pass in shards 1 and 2.
 */
test('control: fails in shard 3 only', (_fixtures, testInfo) => {
  expect(testInfo.project.name, 'the control fails in the desktop project on purpose').not.toBe('desktop');
});
