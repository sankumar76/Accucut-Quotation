import { randomBytes } from 'node:crypto';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { createDisposableUser, E2E_ADMIN } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, ROW_TARGET, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
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
const OWN_ROW_NAME = 'You cannot deactivate your own account';
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
    const person = await createDisposableUser('managed', testInfo);
    await openUsers(page);
    const row = rowOf(page, person.name);
    await expect(row).toContainText(person.email);
    await expect(row).toContainText('Engineer');
    await expect(row).toContainText('Active');
    await expect(rowOf(page, E2E_ADMIN.name)).toContainText('Admin');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
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
    await dialog.getByRole('button', { name: 'Set password' }).click();
    await expect(dialog.getByText('Enter a password.')).toBeVisible();
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
    await expect(alert).toContainText(`${person.name} can no longer sign in. Their tasks and estimates stay as they are. You can activate them again later.`);
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
