import { expect, test } from '@playwright/test';

// THROWAWAY NEGATIVE CONTROL for AQP-208 AC-4. This file exists only on a pull request that is never merged. It fails on
// purpose in the mobile project, which the shard split puts in shard 1 only, so the other shard passes.
test('AQP-208 control: this test fails on purpose in one shard', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'runs in one project, so in one shard');
  expect(1 + 1, 'deliberate failure of the negative control').toBe(3);
});
