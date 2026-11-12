import { expect, test } from '@playwright/test';

/**
 * THROWAWAY negative control A for AQP-276 (AC-3). It lives on a throwaway pull request that is closed unmerged, never on
 * the story branch (DL-091, DL-105). It fails in the `desktop` project only. The file sorts last in the list, so Playwright's
 * own `--shard=4/4` puts the desktop instance in shard 4, while the mobile and tablet instances pass in shards 1 to 3.
 */
test('control: fails in shard 4 only', () => {
  expect(test.info().project.name, 'the control fails in the desktop project on purpose').not.toBe('desktop');
});
