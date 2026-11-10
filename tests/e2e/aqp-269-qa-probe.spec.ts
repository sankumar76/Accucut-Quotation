import { expect, test, type Locator, type Page } from '@playwright/test';

import { ADMIN_STATE } from './support/servers';

/**
 * QA probe, AQP-123 G7 condition F (DL-129 (8), DL-131 (3)): does the `[errors]`-keyed focus effect of the Add dialogs of the Materials (SCR-13),
 * Process (SCR-11) and Users (SCR-14) screens move focus while a person is typing? Run locally, one width at a time; not committed as a CI spec.
 * It opens each Add dialog, submits it empty (every required field is refused), then (a) types 3 letters into the field that has focus (the first
 * refused field), and (b) puts focus on the second refused field by keyboard (Tab / focus()) and types 3 letters. The right behaviour is that every
 * typed letter lands in the field the person is in and focus stays there (UX spec 6.0 "Forms": focus moves to the first message on a refusal only).
 */

test.use({ storageState: ADMIN_STATE });

interface Case {
  readonly name: string;
  readonly path: string;
  readonly opener: string;
  readonly dialog: string;
  readonly submit: string;
}

const CASES: ReadonlyArray<Case> = [
  { name: 'Material (SCR-13, AQP-122)', path: '/masters/materials', opener: 'Add material', dialog: 'Add material', submit: 'Add material' },
  { name: 'Process (SCR-11, AQP-113)', path: '/masters/process', opener: 'Add rate', dialog: 'Add rate', submit: 'Add rate' },
  { name: 'Users (SCR-14, AQP-65)', path: '/users', opener: 'Add user', dialog: 'Add user', submit: 'Add user' },
];

async function openDialog(page: Page, c: Case): Promise<Locator> {
  await page.goto(c.path);
  const opener = page.getByRole('button', { name: c.opener }).first();
  await expect(opener).toBeVisible();
  const dialog = page.getByRole('dialog', { name: c.dialog });
  // The button is plain HTML until React has attached its handler (DEF-011): press until the dialog is there.
  await expect(async () => {
    await opener.click();
    await expect(dialog).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000 });
  return dialog;
}

/** "id|tag|value" of every field of the dialog, and the focused one. */
async function snapshot(page: Page, dialog: Locator): Promise<{ fields: string[]; focused: string }> {
  const fields = await dialog.locator('input, select, textarea').evaluateAll((els) =>
    els.filter((el) => (el as HTMLInputElement).type !== 'hidden').map((el) => `${el.id || el.getAttribute('name')}=${(el as HTMLInputElement).value}`),
  );
  const focused = await page.evaluate(() => `${document.activeElement?.id || document.activeElement?.getAttribute('name') || document.activeElement?.tagName}`);
  return { fields, focused };
}

for (const c of CASES) {
  test(`F-a ${c.name}: typing 3 letters into the first refused field after an empty submit`, async ({ page }, info) => {
    const dialog = await openDialog(page, c);
    await dialog.getByRole('button', { name: c.submit }).click();
    await expect(dialog.locator('[aria-invalid="true"]').nth(1)).toBeVisible();
    const invalid = dialog.locator('[aria-invalid="true"]');
    const count = await invalid.count();
    const first = await invalid.nth(0).evaluate((el) => el.id || el.getAttribute('name'));
    await expect(invalid.nth(0)).toBeFocused();
    await page.keyboard.type('xyz');
    const after = await snapshot(page, dialog);
    info.annotations.push({ type: 'result', description: `${c.name} refused fields=${count} first=${first}; after typing xyz: focused=${after.focused}; ${after.fields.join(' ; ')}` });
    expect(after.focused).toBe(first);
  });

  test(`F-b ${c.name}: typing 3 letters into the second refused field`, async ({ page }, info) => {
    const dialog = await openDialog(page, c);
    await dialog.getByRole('button', { name: c.submit }).click();
    await expect(dialog.locator('[aria-invalid="true"]').nth(1)).toBeVisible();
    const invalid = dialog.locator('[aria-invalid="true"]');
    const first = await invalid.nth(0).evaluate((el) => el.id || el.getAttribute('name'));
    // the second refused TEXT field (a select takes no typed letters, so the Process unit is skipped)
    const textFields = dialog.locator('input[aria-invalid="true"]');
    const second = await textFields.nth(1).evaluate((el) => el.id || el.getAttribute('name'));
    await textFields.nth(1).focus();
    await page.keyboard.type('xyz');
    const after = await snapshot(page, dialog);
    info.annotations.push({ type: 'result', description: `F-b ${c.name} focused=${after.focused} ${after.fields.join(' ; ')}` });
    expect(after.focused).toBe(second);
  });
}
