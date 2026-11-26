import { randomBytes } from 'node:crypto';

import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { createDisposableUser, E2E_ADMIN } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, ROW_TARGET, TABLET_MIN_WIDTH, TOUCH_TARGET, waitUntilHydrated, widthOf } from './support/design-system';
import { ADMIN_STATE } from './support/servers';

/**
 * STORY-01.04 T6 (AC-1, AC-3, AC-4, AC-5, AC-7): SCR-14 at 360x800, 768x1024 and 1366x768 on the development server, signed in
 * as the E2E Admin (the saved browser state of the set-up project). No sideways scroll, axe 0 violations, targets of 44 px
 * (36 px for the icon buttons of a table row), and the add, edit, reset and deactivate dialogs by keyboard: the
 * alert dialog starts on the safe choice, Escape closes, focus returns. Each test works on a person made for it, so the
 * three screen sizes and the retries never meet on one. The words are the UX spec's, written out here.
 *
 * Width (test strategy section 10.5, AQP-199): seven tests check server rules and message text and read no layout (add a
 * person, a used e-mail, a second Admin, edit name and role, the own role, and the two disabled own-row controls). They are
 * tagged `@one-width` and run in the desktop project only. Everything that reads layout stays at three widths: the list (scroll
 * and axe), the 44 px targets, the keyboard test of the add dialog, the messages under the fields, and the reset and
 * deactivate dialogs. `tests/unit/one-width-tag.test.ts` pins the exact set.
 */

test.use({ storageState: ADMIN_STATE });

const ADMIN_TAKEN = 'There is already an active Admin. Only one Admin can be active.';
/** UX spec (ux-expert, AQP-65 comment 11038): the name of the disabled Reset on the Admin's own row, written out here and not imported. */
const OWN_RESET_NAME = 'Reset password is not available for your own account. Use Change password in the account menu.';
const OWN_ROW_NAME = 'You cannot deactivate your own account';
/** UX spec v0.15 (SCR-14, "The Admin's own row"): the visible reason on the Admin's own phone card, written out here and not imported. */
const OWN_PHONE_LINE = 'To change your own password, use Change password in the account menu.';
/** UX spec section 6.0 and SCR-14: the rule sentence that begins both password hints (STORY-01.05 T7). */
const RULE_HINT = 'At least 10 and at most 128 characters, with at least one number and one symbol, such as ! # $ or %.';
const NEEDS_NUMBER_AND_SYMBOL = 'Add at least one number and one symbol, such as ! # $ or %.';
const SAME_AS_EMAIL = "The password cannot be the same as the user's e-mail address.";
const TOO_COMMON = 'That password is too common. Choose a different one.';
const FIRST_PASSWORD = 'invented-first-password-1';
const NEW_PASSWORD = 'invented-temporary-password-2';

/** The row (table) or card (phone) of a person: whichever of the two is shown. */
function rowOf(page: Page, name: string): Locator {
  return page.locator('[data-user-id]:visible').filter({ hasText: name });
}

async function openUsers(page: Page): Promise<void> {
  await page.goto('/users');
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  // The buttons are plain HTML until React has attached their handlers; a press before that is lost (DEF-011).
  await waitUntilHydrated(page, 'main button[data-action="add"]');
}

/** Presses a button with the keyboard, the way a person who does not use a pointer does. */
async function pressWithKeyboard(button: Locator): Promise<void> {
  await button.focus();
  await button.press('Enter');
}

test.describe('the list', () => {
  test('AC-1, AC-7: shows name, e-mail, role and status, does not scroll sideways and has no axe violations', async ({ page }, testInfo) => {
    // AQP-383 / DEF-053, the cause step (DL-427): a diagnostic and nothing else. This case has timed out at 30 s on both attempts on several `master` pushes and the cause is not known. On EVERY attempt it
    // writes one line a step to the job log, `[DEF-053 timing] <width> attempt <n> | <step>: <ms> ms (<total> ms)`, each the moment its step ends, so a case that times out still shows the step it was in, and a
    // "still inside" line at 25 s. Steps: the person (one argon2id hash), the page load, the hydration wait, the row checks, the phone-card text, the sideways-scroll check and the whole-page axe scan; after
    // the hydration it also writes how many people and DOM nodes the list has. It waits for nothing and changes no assertion, budget or scan: the checks are `listCase`, at the end of the file, in the same order
    // as they were, and `timeSteps` is its stopwatch. The case stays on this line and the cases after it keep theirs (the census and the rules name `:58`, `:292` and `:329`).
    // The checks as they were: the person made for this case; /users opened; the row shows the e-mail, Engineer and Active; the Admin row says Admin; on the phone the Admin card says why Reset is
    // disabled and no other card does; no sideways scroll; and one whole-page axe scan with 0 violations. The same lines are attached to the report as `def-053-timing`.
    // The cost of the diagnostic: one count of the list rows and one count of the DOM nodes, taken once after the hydration wait, and a 25 s timer that only writes a line.
    // It is removed with the split of this case (step 2 of DEF-053), which keeps every one of these checks and the same axe scan.
    // Nothing about the case may change what it proves while it is here; see the PR that added it for the figures it gave.
    // (Playwright reports the line of `test(`, so the shape of this block is kept to the number of lines of the case it replaced.)
    const timing = timeSteps(testInfo);
    try {
      await listCase(page, testInfo, timing);
    } finally {
      await timing.finish();
    }
  });

  test('AC-7: controls are at least 44 px, and the icon buttons of a table row at least 36 px', async ({ page }, testInfo) => {
    const person = await createDisposableUser('managed', testInfo);
    await openUsers(page);
    const addBox = await page.getByRole('button', { name: 'Add user' }).boundingBox();
    expect(addBox?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    const buttons = rowOf(page, person.name).getByRole('button');
    const count = await buttons.count();
    expect(count).toBe(3);
    for (let index = 0; index < count; index += 1) {
      const box = await buttons.nth(index).boundingBox();
      const isIconRow = (await buttons.nth(index).getAttribute('data-size')) === 'icon-row';
      const least = isIconRow ? ROW_TARGET : TOUCH_TARGET;
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(least);
      if (isIconRow) expect(box?.width ?? 0).toBeGreaterThanOrEqual(least);
    }
  });

  test('AC-4: the own row cannot be deactivated: the control is disabled and its name says why', { tag: '@one-width' }, async ({ page }) => {
    await openUsers(page);
    const own = rowOf(page, E2E_ADMIN.name).getByRole('button', { name: OWN_ROW_NAME });
    await expect(own).toBeVisible();
    await expect(own).toBeDisabled();
  });

  test('STD-01: the own row cannot be reset either: the control is disabled and its name says why', { tag: '@one-width' }, async ({ page }) => {
    await openUsers(page);
    const own = rowOf(page, E2E_ADMIN.name).getByRole('button', { name: /^Reset password is not available for your own account/ });
    await expect(own).toBeVisible();
    await expect(own).toBeDisabled();
    // DEF-016: the WHOLE accessible name, exactly as the UX spec writes it, full stop included (a regex on its start let a missing stop pass).
    await expect(own).toHaveAccessibleName(OWN_RESET_NAME);
    await expect(rowOf(page, E2E_ADMIN.name).getByRole('button', { name: `Reset password for ${E2E_ADMIN.name}` })).toHaveCount(0);
  });
});

test.describe('add a user (AC-1, AC-3, AC-7)', () => {
  test('by keyboard: the dialog opens on the name, Escape closes it and focus returns to "Add user"', async ({ page }) => {
    await openUsers(page);
    const add = page.getByRole('button', { name: 'Add user' });
    await pressWithKeyboard(add);
    const dialog = page.getByRole('dialog', { name: 'Add user' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Name')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(add).toBeFocused();
  });

  test('adds a person, shows them in the list, and never shows the password', { tag: '@one-width' }, async ({ page }) => {
    const suffix = randomBytes(3).toString('hex');
    const name = `E2E Added ${suffix}`;
    await openUsers(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add user' }));
    const dialog = page.getByRole('dialog', { name: 'Add user' });
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByLabel('E-mail (used to sign in)').fill(`e2e.added.${suffix}@example.test`);
    await dialog.getByLabel('First password').fill(FIRST_PASSWORD);
    await dialog.getByLabel('First password').press('Enter');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: `${name} was added.` })).toBeVisible();
    const row = rowOf(page, name);
    await expect(row).toContainText(`e2e.added.${suffix}@example.test`);
    await expect(row).toContainText('Engineer');
    expect(await page.content()).not.toContain(FIRST_PASSWORD);
  });

  test('refuses a wrong e-mail and an empty password in words, under the field, and keeps what was typed', async ({ page }) => {
    await openUsers(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add user' }));
    const dialog = page.getByRole('dialog', { name: 'Add user' });
    await dialog.getByLabel('Name').fill('E2E Never Added');
    await dialog.getByLabel('E-mail (used to sign in)').fill('not-an-address');
    await dialog.getByRole('button', { name: 'Add user' }).click();
    await expect(dialog.getByText('Enter an e-mail address like name@company.com.')).toBeVisible();
    await expect(dialog.getByText('Enter a password.')).toBeVisible();
    await expect(dialog.getByLabel('Name')).toHaveValue('E2E Never Added');
    await expect(dialog.getByLabel('E-mail (used to sign in)')).toBeFocused();
  });

  test('STORY-01.05 T7: the First password hint begins with the rule, and the password-rule states are named under the field with focus on it', async ({ page }) => {
    const suffix = randomBytes(3).toString('hex');
    const email = `e2e.rule.${suffix}@example.test`;
    await openUsers(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add user' }));
    const dialog = page.getByRole('dialog', { name: 'Add user' });
    const password = dialog.getByLabel('First password');
    await expect(password).toHaveAccessibleDescription(
      `${RULE_HINT} Tell the person in person or by phone; the portal does not e-mail it until Release 2. The person must change it at their first sign-in.`,
    );
    await dialog.getByLabel('Name').fill(`E2E Rule ${suffix}`);
    await dialog.getByLabel('E-mail (used to sign in)').fill(email);

    // "Needs number and symbol" and "Password same as e-mail" are the screen's own checks; "Password too common" is the server's.
    const states: ReadonlyArray<readonly [string, string]> = [
      ['abcdefghijkl', NEEDS_NUMBER_AND_SYMBOL],
      [email.toUpperCase(), SAME_AS_EMAIL],
      ['Password1!', TOO_COMMON],
    ];
    for (const [attempt, message] of states) {
      await password.fill(attempt);
      await dialog.getByRole('button', { name: 'Add user' }).click();
      await expect(dialog.getByText(message, { exact: true })).toBeVisible();
      await expect(password).toHaveAttribute('aria-invalid', 'true');
      await expect(password).toBeFocused();
    }
    await expect(dialog.getByLabel('Name')).toHaveValue(`E2E Rule ${suffix}`);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(rowOf(page, `E2E Rule ${suffix}`)).toHaveCount(0);
  });

  test('DEF-026: after a refusal of several fields, typing into the name keeps focus and every letter there, and so does the e-mail', async ({ page }) => {
    await openUsers(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add user' }));
    const dialog = page.getByRole('dialog', { name: 'Add user' });
    await dialog.getByLabel('E-mail (used to sign in)').fill('not-an-address');
    await dialog.getByRole('button', { name: 'Add user' }).click();
    await expect(dialog.getByText('Enter a password.')).toBeVisible();
    await expect(dialog.getByLabel('Name')).toBeFocused();

    // The later refused field first, while the one before it still has its message (the old code jumped back to it).
    await page.keyboard.press('Tab');
    await expect(dialog.getByLabel('E-mail (used to sign in)')).toBeFocused();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('abc@example.test');
    await expect(dialog.getByLabel('E-mail (used to sign in)')).toBeFocused();
    await expect(dialog.getByLabel('E-mail (used to sign in)')).toHaveValue('abc@example.test');
    await expect(dialog.getByLabel('Name')).toHaveValue('');
    await page.keyboard.press('Shift+Tab');

    // The keys go to whatever has focus, as a keyboard user does. Each key clears a message; none of them may move focus.
    await expect(dialog.getByLabel('Name')).toBeFocused();
    await page.keyboard.type('xyz');
    await expect(dialog.getByLabel('Name')).toBeFocused();
    await expect(dialog.getByLabel('Name')).toHaveValue('xyz');
    await expect(dialog.getByLabel('E-mail (used to sign in)')).toHaveValue('abc@example.test');

    // Tab to the e-mail, replace it, and focus stays there while the password still has its message.
    await page.keyboard.press('Tab');
    await expect(dialog.getByLabel('E-mail (used to sign in)')).toBeFocused();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('xyz@example.test');
    await expect(dialog.getByLabel('E-mail (used to sign in)')).toBeFocused();
    await expect(dialog.getByLabel('E-mail (used to sign in)')).toHaveValue('xyz@example.test');
    await expect(dialog.getByLabel('Name')).toHaveValue('xyz');
    await expect(dialog.getByText('Enter a password.')).toBeVisible();
  });

  test('refuses an e-mail that is already used, whatever its letter case', { tag: '@one-width' }, async ({ page }, testInfo) => {
    const existing = await createDisposableUser('managed', testInfo);
    await openUsers(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add user' }));
    const dialog = page.getByRole('dialog', { name: 'Add user' });
    await dialog.getByLabel('Name').fill('E2E Duplicate');
    await dialog.getByLabel('E-mail (used to sign in)').fill(existing.email.toUpperCase());
    await dialog.getByLabel('First password').fill(FIRST_PASSWORD);
    await dialog.getByLabel('First password').press('Enter');
    await expect(dialog.getByText('A user with this e-mail already exists.')).toBeVisible();
    await expect(dialog).toBeVisible();
    // The server refusal takes focus to the field it names (UX spec 6.0 "Forms"; QLT-03 of AQP-269).
    await expect(dialog.getByLabel('E-mail (used to sign in)')).toBeFocused();
  });

  test('AC-3: a second Admin is refused, the current Admin is named, and nobody is added', { tag: '@one-width' }, async ({ page }) => {
    const suffix = randomBytes(3).toString('hex');
    const name = `E2E Second Admin ${suffix}`;
    await openUsers(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add user' }));
    const dialog = page.getByRole('dialog', { name: 'Add user' });
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByLabel('E-mail (used to sign in)').fill(`e2e.second.admin.${suffix}@example.test`);
    await dialog.getByRole('combobox', { name: 'Role' }).click();
    await page.getByRole('option', { name: 'Admin' }).click();
    await dialog.getByLabel('First password').fill(FIRST_PASSWORD);
    await dialog.getByLabel('First password').press('Enter');
    await expect(dialog.getByText(ADMIN_TAKEN)).toBeVisible();
    await expect(dialog).toBeVisible();
    // The message sits under Role and takes focus (SCR-14 "Second Admin"; QLT-03 of AQP-269).
    await expect(dialog.getByRole('combobox', { name: 'Role' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('alert').filter({ hasText: `There is already an active Admin: ${E2E_ADMIN.name}.` })).toBeVisible();
    await expect(rowOf(page, name)).toHaveCount(0);
  });
});

test.describe('edit (AC-1)', () => {
  test('changes the name and the role of a person', { tag: '@one-width' }, async ({ page }, testInfo) => {
    const person = await createDisposableUser('managed', testInfo);
    await openUsers(page);
    await pressWithKeyboard(rowOf(page, person.name).getByRole('button', { name: `Edit ${person.name}` }));
    const dialog = page.getByRole('dialog', { name: `Edit ${person.name}` });
    await expect(dialog).toContainText(person.email);
    const renamed = `${person.name} Renamed`;
    await dialog.getByLabel('Name').fill(renamed);
    await dialog.getByRole('combobox', { name: 'Role' }).click();
    await page.getByRole('option', { name: 'Lead' }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    const row = rowOf(page, renamed);
    await expect(row).toContainText('Lead');
    await expect(row).toContainText(person.email);
  });

  test('AC-4: the Admin cannot change their own role: the role list is disabled and says why', { tag: '@one-width' }, async ({ page }) => {
    await openUsers(page);
    await pressWithKeyboard(rowOf(page, E2E_ADMIN.name).getByRole('button', { name: `Edit ${E2E_ADMIN.name}` }));
    const dialog = page.getByRole('dialog', { name: `Edit ${E2E_ADMIN.name}` });
    await expect(dialog.getByRole('combobox', { name: 'Role' })).toBeDisabled();
    await expect(dialog.getByText('You cannot change your own role.')).toBeVisible();
  });
});

test.describe('reset a password (AC-5, AC-7)', () => {
  test('asks for a password, then sets it; Escape closes the dialog and focus returns to the button', async ({ page }, testInfo) => {
    const person = await createDisposableUser('managed', testInfo);
    await openUsers(page);
    const opener = rowOf(page, person.name).getByRole('button', { name: `Reset password for ${person.name}` });
    await pressWithKeyboard(opener);
    const dialog = page.getByRole('dialog', { name: `Reset password for ${person.name}` });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();

    await pressWithKeyboard(opener);
    // STORY-01.05 T7: the hint begins with the rule, and the two reset states are named under the field.
    await expect(dialog.getByLabel('New password')).toHaveAccessibleDescription(
      `${RULE_HINT} The old password stops working straight away. The person must change it at their next sign-in.`,
    );
    await dialog.getByRole('button', { name: 'Set password' }).click();
    await expect(dialog.getByText('Enter a password.')).toBeVisible();
    await dialog.getByLabel('New password').fill('abcdefghijkl');
    await dialog.getByRole('button', { name: 'Set password' }).click();
    await expect(dialog.getByText(NEEDS_NUMBER_AND_SYMBOL, { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('New password')).toBeFocused();
    await dialog.getByLabel('New password').fill(person.email.toUpperCase());
    await dialog.getByRole('button', { name: 'Set password' }).click();
    await expect(dialog.getByText(SAME_AS_EMAIL, { exact: true })).toBeVisible();
    await dialog.getByLabel('New password').fill('Welcome@123');
    await dialog.getByRole('button', { name: 'Set password' }).click();
    await expect(dialog.getByText(TOO_COMMON, { exact: true })).toBeVisible();
    await dialog.getByLabel('New password').fill(NEW_PASSWORD);
    await dialog.getByLabel('New password').press('Enter');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: `Password set for ${person.name}.` })).toBeVisible();
    expect(await page.content()).not.toContain(NEW_PASSWORD);
  });
});

test.describe('deactivate and activate (AC-1, AC-2, AC-7)', () => {
  test('an alert dialog on the safe choice; Escape closes it and focus returns; then deactivates and activates', async ({ page }, testInfo) => {
    const person = await createDisposableUser('managed', testInfo);
    await openUsers(page);
    const opener = rowOf(page, person.name).getByRole('button', { name: `Deactivate ${person.name}` });
    await pressWithKeyboard(opener);
    const alert = page.getByRole('alertdialog', { name: `Deactivate ${person.name}?` });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(`${person.name} can no longer sign in. Their tasks and estimates stay as they are. You can reassign their open tasks. You can activate them again later.`);
    await expect(alert.getByRole('button', { name: 'Keep active' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(alert).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(rowOf(page, person.name)).toContainText('Active');

    await pressWithKeyboard(opener);
    await alert.getByRole('button', { name: 'Deactivate' }).click();
    await expect(alert).toBeHidden();
    await expect(rowOf(page, person.name)).toContainText('Deactivated');
    await expect(page.getByRole('status').filter({ hasText: `${person.name} was deactivated and can no longer sign in.` })).toBeVisible();

    await pressWithKeyboard(rowOf(page, person.name).getByRole('button', { name: `Activate ${person.name}` }));
    await expect(rowOf(page, person.name)).toContainText('Active');
    await expect(rowOf(page, person.name).getByRole('button', { name: `Deactivate ${person.name}` })).toBeVisible();
  });
});

/** The checks of the case at `:58` (AQP-383), in their order, as they were; `timing` only writes the time each step took. The person is made first, as before; `openUsers` is split so that its page load and its hydration wait are timed apart. */
async function listCase(page: Page, testInfo: TestInfo, timing: ReturnType<typeof timeSteps>): Promise<void> {
  const person = await createDisposableUser('managed', testInfo);
  timing.done('the person (createDisposableUser)', 'the page load');
  await page.goto('/users');
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  timing.done('the page load (goto and the heading)', 'the hydration wait');
  // The buttons are plain HTML until React has attached their handlers; a press before that is lost (DEF-011).
  await waitUntilHydrated(page, 'main button[data-action="add"]');
  timing.done('the hydration wait', 'the row checks');
  timing.note(`the list holds ${String(await page.locator('[data-user-id]').count())} people and ${String(await page.evaluate(() => document.querySelectorAll('*').length))} DOM nodes`);
  const row = rowOf(page, person.name);
  await expect(row).toContainText(person.email);
  await expect(row).toContainText('Engineer');
  await expect(row).toContainText('Active');
  await expect(rowOf(page, E2E_ADMIN.name)).toContainText('Admin');
  timing.done('the row checks (the person and the Admin)', 'the phone-card text');
  // STORY-01.05 T7: on the phone card, and only there, the Admin's own row says in text why Reset password is disabled; no other card does.
  if ((await widthOf(page)) < TABLET_MIN_WIDTH) {
    await expect(rowOf(page, E2E_ADMIN.name).getByText(OWN_PHONE_LINE, { exact: true })).toBeVisible();
    await expect(rowOf(page, person.name).getByText(OWN_PHONE_LINE)).toHaveCount(0);
    await expect(page.getByText(OWN_PHONE_LINE)).toHaveCount(1);
  } else {
    await expect(page.getByText(OWN_PHONE_LINE)).toBeHidden();
  }
  timing.done('the phone-card text', 'the sideways-scroll check');
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  timing.done('the sideways-scroll check', 'the axe scan');
  await expectNoAxeViolations(page);
  timing.done('the axe scan (the whole page)', 'the end');
}

/** The stopwatch of the case: a line to the job log the moment each step ends (so a time-out still shows where it was), a "still inside" line at 25 s, and the same lines attached to the report as `def-053-timing`. */
function timeSteps(testInfo: TestInfo) {
  const startedAt = Date.now();
  let stepStart = startedAt;
  let current = 'the person';
  const lines: string[] = [];
  const say = (text: string): void => {
    const line = `[DEF-053 timing] ${testInfo.project.name} attempt ${String(testInfo.retry + 1)} | ${text}`;
    lines.push(line);
    process.stdout.write(`${line}\n`);
  };
  const watchdog = setTimeout(() => say(`still inside "${current}" at ${String(Date.now() - startedAt)} ms`), 25_000);
  return {
    done(name: string, next: string): void {
      const now = Date.now();
      say(`${name}: ${String(now - stepStart)} ms (${String(now - startedAt)} ms)`);
      stepStart = now;
      current = next;
    },
    note: say,
    async finish(): Promise<void> {
      clearTimeout(watchdog);
      say(`end: ${String(Date.now() - startedAt)} ms`);
      await testInfo.attach('def-053-timing', { body: lines.join('\n'), contentType: 'text/plain' }).catch(() => undefined);
    },
  };
}
