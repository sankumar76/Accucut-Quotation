import { expect, test } from '@playwright/test';

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'each test sets its own width, so one project runs it');
});

test('CONTROL plant: a third own-width file, not ruled', () => {
  expect(1 + 1).toBe(2);
});
