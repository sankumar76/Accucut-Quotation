import { expect, it } from 'vitest';

// Run on its own by tests/unit/global-setup-wiring.test.ts to prove the database guard is connected.
it('runs when the guard lets the run start', () => {
  expect(1 + 1).toBe(2);
});
