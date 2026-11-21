import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { initialsOf } from '../../src/lib/initials';

import { createDisposableUser, E2E_LEAD, E2E_PASSWORD, signInThroughThePage, useFreshAddress } from './support/auth';
import { horizontalOverflow, TABLET_MIN_WIDTH, waitForAnimationsToFinish, widthOf } from './support/design-system';
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

/** The sign-in page, then the queue: the start of every test, as the person with this e-mail (after `useFreshAddress`, which a test calls in its own callback). */
async function signInAs(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await signInThroughThePage(page, email, E2E_PASSWORD);
  await expect(page).toHaveURL(/\/queue$/);
}

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
  test.beforeEach(async ({ page, context }) => {
    await useFreshAddress(context);
    await signInAs(page, E2E_LEAD.email);
  });

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

/**
 * DEF-034 (AQP-288, NFR-016, ux-spec SCR-25 and 6.0): the longest name the Users form accepts is 120 characters. The top bar cuts it with an
 * ellipsis from 768 px, the full name stays in the accessible name, and the page does not scroll sideways, whatever the name is made of. Each
 * test makes its own person (`long-name`) and signs in as that person, so the shared Lead is never renamed. Capitals M and W are among the widest
 * letters, so 120 of them are wider than the top bar at every width of the suite (1366 px included): the name is cut at every width from 768 px.
 */
const LONGEST_NAME_LENGTH = 120;
const LONG_NAMES: Readonly<Record<string, string>> = {
  'with no space': 'MWMWMWMWMW'.repeat(12),
  'with spaces': `${'MWMWMWMWM '.repeat(11)}MWMWMWMWMW`,
};

/** What one measurement of the trigger reads from the page. */
interface TriggerFit {
  readonly pageOverflow: number;
  readonly triggerRight: number;
  readonly barRight: number | null;
  readonly nameShown: boolean;
  readonly nameCut: boolean;
  readonly textOverflow: string;
}

/**
 * The page does not scroll sideways and the trigger ends inside the top bar. From 768 px the name is on screen and is cut with an ellipsis (its text is
 * wider than its box and the box asks for an ellipsis); below 768 px only the initials show, so there is no name to cut.
 */
async function expectTriggerFits(trigger: Locator, name: string, width: number, state: string): Promise<void> {
  const fit: TriggerFit = await trigger.evaluate((element, fullName) => {
    const bar = element.closest('header');
    const nameBox = Array.from(element.querySelectorAll('span')).find((span) => span.textContent === fullName);
    return {
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      triggerRight: Math.round(element.getBoundingClientRect().right),
      barRight: bar === null ? null : Math.round(bar.getBoundingClientRect().right),
      nameShown: nameBox !== undefined && nameBox.offsetWidth > 0,
      nameCut: nameBox !== undefined && nameBox.scrollWidth > nameBox.clientWidth,
      textOverflow: nameBox === undefined ? '' : getComputedStyle(nameBox).textOverflow,
    };
  }, name);
  expect(fit.pageOverflow, `${state}: the page scrolls ${fit.pageOverflow} px sideways (the trigger ends at ${fit.triggerRight} px)`).toBeLessThanOrEqual(0);
  expect(fit.barRight, `${state}: the trigger is inside the top bar`).not.toBeNull();
  expect(fit.triggerRight, `${state}: the trigger ends inside the top bar`).toBeLessThanOrEqual(fit.barRight ?? 0);
  if (width < TABLET_MIN_WIDTH) {
    expect(fit.nameShown, `${state}: below 768 px only the initials show`).toBe(false);
    return;
  }
  expect(fit.nameShown, `${state}: the name shows from 768 px`).toBe(true);
  expect(fit.nameCut, `${state}: the name is cut`).toBe(true);
  expect(fit.textOverflow, `${state}: the cut ends in an ellipsis`).toBe('ellipsis');
}

/** The open panel: inside the window, and every line of the label (name, e-mail, role) fits its box, so a long name wraps and does not run out of the panel. */
async function expectMenuLabelFits(menu: Locator, name: string): Promise<void> {
  const label = await menu.evaluate((element, fullName) => {
    const box = element.getBoundingClientRect();
    const lines = Array.from(element.querySelectorAll('[data-slot="dropdown-menu-label"] span'));
    return {
      insideWindow: box.left >= 0 && box.right <= window.innerWidth,
      lines: lines.length,
      namePrinted: lines.some((line) => line.textContent === fullName),
      runOut: lines.filter((line) => line.scrollWidth > line.clientWidth).map((line) => (line.textContent ?? '').slice(0, 20)),
    };
  }, name);
  expect(label.insideWindow, 'the open panel is inside the window').toBe(true);
  expect(label.lines, 'the label has name, e-mail and role').toBe(3);
  expect(label.namePrinted, 'the label prints the whole name').toBe(true);
  expect(label.runOut, 'no line of the label runs out of the panel').toEqual([]);
}

test.describe('DEF-034: a 120-character name stays inside the top bar (2 tests)', () => {
  for (const [kind, name] of Object.entries(LONG_NAMES)) {
    test(`a 120-character name ${kind}: closed, open and after the first open the page does not scroll sideways, and the name keeps its full accessible name`, async ({ page, context }, testInfo) => {
      expect(name.length, 'the longest name the Users form accepts').toBe(LONGEST_NAME_LENGTH);
      const person = await createDisposableUser('long-name', testInfo, 'LEAD', name);
      await useFreshAddress(context);
      await signInAs(page, person.email);
      await openRouteAndSettle(page, '/queue');
      const trigger = page.locator(TRIGGER);
      const width = await widthOf(page);
      await expect(trigger).toHaveAccessibleName(`Account menu, ${initialsOf(name)}, ${name}, Lead`);

      await expectTriggerFits(trigger, name, width, 'closed');

      await trigger.click();
      const menu = page.getByRole('menu');
      await expect(menu).toBeVisible();
      expect(await horizontalOverflow(page), 'open: the page scrolls sideways').toBeLessThanOrEqual(0);
      await expectMenuLabelFits(menu, name);

      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expectTriggerFits(trigger, name, width, 'after the first open (the Radix trigger)');
      await expect(trigger).toHaveAccessibleName(`Account menu, ${initialsOf(name)}, ${name}, Lead`);
    });
  }
});
