import { expect, test } from '@playwright/test';

/**
 * AQP-199 AC-4 negative control. This file exists only on the throwaway branch `chore/AQP-199-negative-control`, whose
 * pull request is never merged: one failing E2E test must fail the required check "Stages 1 to 11".
 */
test('AQP-199 negative control: this test fails on purpose', () => {
  expect(1 + 1).toBe(3);
});
