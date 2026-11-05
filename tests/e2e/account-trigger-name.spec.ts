import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator } from '@playwright/test';

import { E2E_LEAD, E2E_PASSWORD, signInThroughThePage, useFreshAddress } from './support/auth';
import { TABLET_MIN_WIDTH, waitForAnimationsToFinish, widthOf } from './support/design-system';
import { openRouteAndSettle, ScriptGate, SLOW_OPEN_WAIT_MILLISECONDS } from './support/lazy-load';
import { PRODUCTION_URL } from './support/servers';

/**
 * DEF-014 (AQP-198), WCAG 2.5.3 Label in Name: the account trigger's accessible name contains the text it shows, at 360, 768 and
 * 1366 px (the three projects). The name is `Account menu, <initials>, <name>, <role>` (UX spec SCR-25, "Account trigger:
 * accessible name"), the same at every width and in every state: closed, first open pending, first open failed, and open (the
 * Radix trigger that replaces the plain button). The comparison is the one WCAG and axe make: case and punctuation do not count.
 * Run on the production build, signed in as the invented Lead, as `shell-lazy-load.spec.ts` does.
 */

test.use({ baseURL: PRODUCTION_URL, storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page, context }) => {
  await useFreshAddress(context);
  await page.goto('/sign-in');
  await signInThroughThePage(page, E2E_LEAD.email, E2E_PASSWORD);
  await expect(page).toHaveURL(/\/queue$/);
});

const TRIGGER = 'button[aria-label^="Account menu"]';
const EXPECTED_NAME = 'Account menu, EL, E2E Lead, Lead';
const NAME_PATTERN = /^Account menu, [A-Z]{1,2}, .+, .+$/;
const RULE = 'label-content-name-mismatch';

/** What WCAG 2.5.3 and axe compare: lower case, no punctuation, one space between words. */
const normalise = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The text the trigger shows at this width: `innerText` leaves out what `display: none` hides (the name and role below 768 px). */
const visibleTextOf = (trigger: Locator): Promise<string> => trigger.evaluate((element) => (element instanceof HTMLElement ? element.innerText : ''));

async function expectLabelInName(trigger: Locator, width: number): Promise<void> {
  await expect(trigger).toHaveAccessibleName(NAME_PATTERN);
  await expect(trigger).toHaveAccessibleName(EXPECTED_NAME);

  const visible = normalise(await visibleTextOf(trigger));
  // Not vacuous: the initials at every width, and the name and role from 768 px.
  expect(visible, 'the text the screen shows').toBe(width >= TABLET_MIN_WIDTH ? 'el e2e lead lead' : 'el');
  const name = normalise((await trigger.getAttribute('aria-label')) ?? '');
  expect(name, 'the accessible name contains the visible text').toContain(visible);
}

/** axe's own check of the rule, on the trigger alone. The rule must apply (be in `passes`) and not fail. */
async function expectAxeLabelInNamePasses(trigger: Locator): Promise<void> {
  const page = trigger.page();
  await waitForAnimationsToFinish(page);
  const results = await new AxeBuilder({ page }).include(TRIGGER).withRules([RULE]).analyze();
  expect(
    results.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.target.join(' ')) })),
    `${RULE} violations`,
  ).toEqual([]);
  expect(results.passes.map((pass) => pass.id), `${RULE} was applied to the trigger`).toContain(RULE);
}

test.describe('DEF-014: the account trigger name contains its visible text', () => {
  test('closed: the name matches the pattern, contains the visible text, and axe label-content-name-mismatch passes', async ({ page }) => {
    await openRouteAndSettle(page, '/queue');
    const trigger = page.locator(TRIGGER);
    await expectLabelInName(trigger, await widthOf(page));
    await expectAxeLabelInNamePasses(trigger);
  });

  test('pending: while the first open waits, the name is unchanged and the state is on aria-busy', async ({ page }) => {
    const gate = new ScriptGate();
    await gate.install(page);
    await openRouteAndSettle(page, '/queue');
    const trigger = page.locator(TRIGGER);
    gate.mode = 'slow';
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-busy', 'true');
    await expectLabelInName(trigger, await widthOf(page));
    await expectAxeLabelInNamePasses(trigger);
    await expect(page.getByRole('menu')).toBeVisible({ timeout: SLOW_OPEN_WAIT_MILLISECONDS });
  });

  test('failed: after a failed first open, the name is unchanged', async ({ page }) => {
    const gate = new ScriptGate();
    await gate.install(page);
    await openRouteAndSettle(page, '/queue');
    const trigger = page.locator(TRIGGER);
    gate.mode = 'fail';
    await trigger.click();
    await expect(page.getByRole('alert').filter({ hasText: 'did not open' })).toHaveCount(1);
    await expect(trigger).toHaveAttribute('aria-describedby', /.+/);
    await expectLabelInName(trigger, await widthOf(page));
    await expectAxeLabelInNamePasses(trigger);
  });

  test('open, and after the first open (the Radix trigger): the name is unchanged', async ({ page }) => {
    await openRouteAndSettle(page, '/queue');
    const trigger = page.locator(TRIGGER);
    await trigger.click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // The trigger is the Radix one now; while the menu is open it is still found by attribute, not by role.
    expect(await trigger.getAttribute('aria-label')).toBe(EXPECTED_NAME);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expectLabelInName(trigger, await widthOf(page));
    await expectAxeLabelInNamePasses(trigger);
  });
});
