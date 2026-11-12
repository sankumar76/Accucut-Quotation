import { randomBytes } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { z } from 'zod';

import { expectNoAxeViolations, horizontalOverflow, ROW_TARGET, TOUCH_TARGET } from './support/design-system';
import { ADMIN_STATE } from './support/servers';
import {
  API,
  JSON_HEADERS,
  LOCKED_REASON,
  makeTreatment,
  NAME_REQUIRED,
  NAME_RESERVED,
  NAME_TAKEN,
  newTreatmentName,
  openTreatments,
  pressWithKeyboard,
  rowOf,
  TAB,
} from './support/treatments';

/**
 * STORY-02.05 T5 (AC-1 to AC-4, AC-6, AC-8): SCR-13 "Materials and lists", the Treatment / Color tab, at 360x800, 768x1024 and 1366x768 on the
 * development server, signed in as the E2E Admin (the saved browser state of the set-up project). No sideways scroll, axe 0 violations, targets of
 * 44 px (36 px for the icon buttons of a table row), and add, rename and delete working by keyboard: Enter opens the dialog on the Name field, Enter in
 * the field saves, Escape closes, the delete is an alert dialog that starts on "Keep treatment", and focus returns to the button that opened it.
 *
 * Each test works on treatments it makes for itself through the API, so the three screen sizes and the retries never meet on one treatment. What
 * happens when a request fails, and where focus goes, is `treatments-focus.spec.ts`; the table at eleven widths is `masters-table-actions.spec.ts`.
 * The audit entry and the database are judged against PostgreSQL in `tests/integration/masters/treatments.test.ts`. The words are the UX spec's and the
 * story's, written out in `support/treatments.ts`. Names are invented.
 */

test.use({ storageState: ADMIN_STATE });

const idList = z.object({ treatments: z.array(z.object({ id: z.string(), name: z.string(), locked: z.boolean() })) });

test.describe('the tab and its list (AC-1, AC-8)', () => {
  test('AC-1, AC-8: "Other" is listed first with its reason as text and no buttons; a treatment has Rename and Delete named for it; no sideways scroll, axe 0 violations', async ({ page }, testInfo) => {
    const { name } = await makeTreatment(page, newTreatmentName(testInfo));
    await openTreatments(page);
    await expect(page.getByRole('tab', { name: TAB })).toHaveAttribute('aria-selected', 'true');
    const first = page.locator('[data-item-id]:visible').first();
    await expect(first).toContainText('Other');
    await expect(first).toContainText(LOCKED_REASON);
    await expect(first.getByRole('button')).toHaveCount(0);
    const row = rowOf(page, name);
    await expect(row.getByRole('button', { name: `Rename ${name}` })).toBeVisible();
    await expect(row.getByRole('button', { name: `Delete ${name}` })).toBeVisible();
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Treatment / Color, scrollable' })).toBeVisible();
    } else {
      await expect(page.getByRole('list', { name: 'Treatment / Color' })).toBeVisible();
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-8: controls are at least 44 px, and the icon button of a table row at least 36 px', async ({ page }, testInfo) => {
    const { name } = await makeTreatment(page, newTreatmentName(testInfo));
    await openTreatments(page);
    expect((await page.getByRole('button', { name: 'Add treatment' }).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    expect((await page.getByRole('tab', { name: TAB }).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    const rename = rowOf(page, name).getByRole('button', { name: `Rename ${name}` });
    const box = await rename.boundingBox();
    const isIconRow = (page.viewportSize()?.width ?? 0) >= 768;
    const least = isIconRow ? ROW_TARGET : TOUCH_TARGET;
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(least);
    if (isIconRow) expect(box?.width ?? 0).toBeGreaterThanOrEqual(least);
  });

  test('a name of 100 characters with no space wraps inside its cell: no sideways scroll of the page at any width', async ({ page }, testInfo) => {
    const long = `E2E-${testInfo.project.name}-${testInfo.retry}-${testInfo.repeatEachIndex}-${randomBytes(3).toString('hex')}-`.padEnd(100, 'W');
    expect(long).toHaveLength(100);
    await makeTreatment(page, long);
    await openTreatments(page);
    await expect(rowOf(page, long)).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('add a treatment (AC-2, AC-6, AC-8)', () => {
  test('by keyboard: Enter opens the dialog on Name, it fits the screen and has no axe violations, Escape closes it and focus returns to "Add treatment"', async ({ page }) => {
    await openTreatments(page);
    const add = page.getByRole('button', { name: 'Add treatment' });
    await pressWithKeyboard(add);
    const dialog = page.getByRole('dialog', { name: 'Add treatment' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Name')).toBeFocused();
    const box = await dialog.boundingBox();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(add).toBeFocused();
  });

  test('by keyboard: types a name and saves with Enter; the list shows it, the notice says it was added, and focus returns to "Add treatment"', async ({ page }, testInfo) => {
    const name = newTreatmentName(testInfo);
    await openTreatments(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add treatment' }));
    const dialog = page.getByRole('dialog', { name: 'Add treatment' });
    await expect(dialog.getByLabel('Name')).toBeFocused();
    await page.keyboard.type(`  ${name}  `);
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: `${name} was added. The change is in the audit log.` })).toBeVisible();
    await expect(rowOf(page, name)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add treatment' })).toBeFocused();
  });

  test('refuses an empty name in words under the field, keeps focus there, and does so again on a second press (AC-2)', async ({ page }) => {
    await openTreatments(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add treatment' }));
    const dialog = page.getByRole('dialog', { name: 'Add treatment' });
    await dialog.getByRole('button', { name: 'Add treatment' }).click();
    await expect(dialog.getByText(NAME_REQUIRED)).toBeVisible();
    await expect(dialog.getByLabel('Name')).toBeFocused();
    await expect(dialog.getByLabel('Name')).toHaveAttribute('aria-invalid', 'true');
    // Focus is somewhere else when the second refusal comes, and the refusal moves it back.
    await dialog.getByRole('button', { name: 'Cancel' }).focus();
    await dialog.getByRole('button', { name: 'Add treatment' }).click();
    await expect(dialog.getByLabel('Name')).toBeFocused();
  });

  test('state "Duplicate name": a name another treatment has, in any letter case, is refused under the field with the sentence of AC-2; the dialog stays open with what was typed', async ({ page }, testInfo) => {
    const { name } = await makeTreatment(page, newTreatmentName(testInfo));
    await openTreatments(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add treatment' }));
    const dialog = page.getByRole('dialog', { name: 'Add treatment' });
    await dialog.getByLabel('Name').fill(name.toUpperCase());
    await dialog.getByRole('button', { name: 'Add treatment' }).click();
    await expect(dialog.getByText(NAME_TAKEN)).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Name')).toBeFocused();
    await expect(dialog.getByLabel('Name')).toHaveValue(name.toUpperCase());
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect(rowOf(page, name)).toHaveCount(1);
  });

  test.describe('the names the system keeps (AC-2)', () => {
    for (const reserved of ['Other', ' oTHER ', 'Not applicable', 'NOT  APPLICABLE']) {
      test(`the real server refuses ${JSON.stringify(reserved)} with 422 NAME_RESERVED and a sentence that names neither entry; the screen shows it under Name and stores nothing`, async ({ page, request }) => {
        const refused = await request.post(API, { headers: JSON_HEADERS, data: { name: reserved } });
        expect(refused.status()).toBe(422);
        const body = z.object({ code: z.string(), errors: z.array(z.object({ field: z.string(), message: z.string() })) }).parse(await refused.json());
        expect(body).toMatchObject({ code: 'NAME_RESERVED', errors: [{ field: 'name', message: NAME_RESERVED }] });
        expect(NAME_RESERVED).not.toMatch(/other|applicable/i);

        await openTreatments(page);
        await pressWithKeyboard(page.getByRole('button', { name: 'Add treatment' }));
        const dialog = page.getByRole('dialog', { name: 'Add treatment' });
        await dialog.getByLabel('Name').fill(reserved);
        await dialog.getByRole('button', { name: 'Add treatment' }).click();
        await expect(dialog.getByText(NAME_RESERVED)).toBeVisible();
        await expect(dialog.getByLabel('Name')).toBeFocused();
        await expect(dialog.getByLabel('Name')).toHaveValue(reserved);
        await page.keyboard.press('Escape');
        const listed = idList.parse(await (await request.get(API)).json()).treatments;
        // Nothing was stored: the only entry with such a name is the system's own "Other" (and none reads "Not applicable").
        const normalised = (text: string): string => text.trim().replace(/\s+/g, ' ').toLowerCase();
        const expected = normalised(reserved) === 'other' ? 1 : 0;
        expect(listed.filter((treatment) => normalised(treatment.name) === normalised(reserved))).toHaveLength(expected);
      });
    }
  });
});

test.describe('rename a treatment (AC-2, AC-6, AC-8)', () => {
  test('by keyboard: Enter on "Rename <name>" opens the dialog on the name; a new name and Enter save it; the row, the notice and the focus follow', async ({ page }, testInfo) => {
    const { name } = await makeTreatment(page, newTreatmentName(testInfo));
    const renamed = `${name}-renamed`;
    await openTreatments(page);
    await pressWithKeyboard(rowOf(page, name).getByRole('button', { name: `Rename ${name}` }));
    const dialog = page.getByRole('dialog', { name: `Rename ${name}` });
    await expect(dialog.getByLabel('Name')).toBeFocused();
    await expect(dialog.getByLabel('Name')).toHaveValue(name);
    await expectNoAxeViolations(page);
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(renamed);
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    // No audit-log clause: a rename that finds the name already there writes no entry (ux-spec v0.22).
    const notice = page.getByRole('status').filter({ hasText: `${name} was renamed to ${renamed}.` });
    await expect(notice).toBeVisible();
    await expect(notice).not.toContainText('audit');
    await expect(rowOf(page, renamed)).toBeVisible();
    // The renamed name contains the old one, so the old name is looked for as a whole (exact), not as a part of the new one.
    await expect(page.getByRole('button', { name: `Rename ${name}`, exact: true })).toHaveCount(0);
    await expect(rowOf(page, renamed).getByRole('button', { name: `Rename ${renamed}` })).toBeFocused();
  });

  test('a rename that changes nothing closes without a request and without a message', async ({ page }, testInfo) => {
    const { name } = await makeTreatment(page, newTreatmentName(testInfo));
    const sent: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'PATCH') sent.push(request.url());
    });
    await openTreatments(page);
    await pressWithKeyboard(rowOf(page, name).getByRole('button', { name: `Rename ${name}` }));
    const dialog = page.getByRole('dialog', { name: `Rename ${name}` });
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(rowOf(page, name).getByRole('button', { name: `Rename ${name}` })).toBeFocused();
    await expect(page.locator('main').getByRole('status').filter({ hasText: /\S/ })).toHaveCount(0);
    expect(sent).toEqual([]);
  });

  test('a name another treatment has, in any letter case, is refused under the field and nothing is renamed', async ({ page }, testInfo) => {
    const first = await makeTreatment(page, newTreatmentName(testInfo));
    const second = await makeTreatment(page, `${newTreatmentName(testInfo)}-second`);
    await openTreatments(page);
    await pressWithKeyboard(rowOf(page, second.name).getByRole('button', { name: `Rename ${second.name}` }));
    const dialog = page.getByRole('dialog', { name: `Rename ${second.name}` });
    await dialog.getByLabel('Name').fill(first.name.toUpperCase());
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.getByText(NAME_TAKEN)).toBeVisible();
    await expect(dialog.getByLabel('Name')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(rowOf(page, second.name)).toHaveCount(1);
  });
});

test.describe('delete a treatment (AC-3, AC-4, AC-6, AC-8)', () => {
  test('by keyboard: the alert dialog starts on "Keep treatment"; Escape closes it with nothing sent and focus back on Delete; confirming removes the row, says so, and puts focus on the page heading', async ({ page }, testInfo) => {
    const { name } = await makeTreatment(page, newTreatmentName(testInfo));
    const sent: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'DELETE') sent.push(request.url());
    });
    await openTreatments(page);
    const del = rowOf(page, name).getByRole('button', { name: `Delete ${name}` });
    await pressWithKeyboard(del);
    const dialog = page.getByRole('alertdialog', { name: `Delete ${name}?` });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Keep treatment' })).toBeFocused();
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(del).toBeFocused();
    expect(sent).toEqual([]);

    await pressWithKeyboard(del);
    await dialog.getByRole('button', { name: 'Delete treatment' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: `${name} was deleted. The change is in the audit log.` })).toBeVisible();
    await expect(rowOf(page, name)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Materials and lists' })).toBeFocused();
    expect(sent).toHaveLength(1);
  });

  test('a treatment that was deleted elsewhere is reported in a notice, not as a failure', async ({ page, request }, testInfo) => {
    const { name, id } = await makeTreatment(page, newTreatmentName(testInfo));
    await openTreatments(page);
    expect((await request.delete(`${API}/${id}`, { headers: JSON_HEADERS })).status()).toBe(204);
    await pressWithKeyboard(rowOf(page, name).getByRole('button', { name: `Delete ${name}` }));
    await page.getByRole('alertdialog', { name: `Delete ${name}?` }).getByRole('button', { name: 'Delete treatment' }).click();
    await expect(page.getByRole('status').filter({ hasText: `${name} was already deleted.` })).toBeVisible();
    await expect(rowOf(page, name)).toHaveCount(0);
  });
});

test.describe('the locked "Other" entry and the options list (AC-3, AC-5)', () => {
  test('AC-3: the real server refuses a rename and a delete of "Other" with 409 TREATMENT_LOCKED, and the list is unchanged', async ({ request }) => {
    const before = idList.parse(await (await request.get(API)).json()).treatments;
    const other = before.find((treatment) => treatment.locked);
    expect(other?.name).toBe('Other');
    const id = other?.id ?? '';
    const renamed = await request.patch(`${API}/${id}`, { headers: JSON_HEADERS, data: { name: 'Invented renamed other' } });
    const deleted = await request.delete(`${API}/${id}`, { headers: JSON_HEADERS });
    for (const answer of [renamed, deleted]) {
      expect(answer.status()).toBe(409);
      expect(z.object({ code: z.string() }).parse(await answer.json()).code).toBe('TREATMENT_LOCKED');
    }
    const after = idList.parse(await (await request.get(API)).json()).treatments;
    expect(after.find((treatment) => treatment.id === id)).toEqual(other);
  });

  test('AC-5: the options list carries an ID and a name and nothing else, "Other" included', async ({ request }) => {
    const answer = await request.get(`${API.replace('/treatments', '/options/treatments')}`);
    expect(answer.status()).toBe(200);
    const options = z.object({ options: z.array(z.record(z.string(), z.unknown())) }).parse(await answer.json()).options;
    expect(options.some((option) => option['name'] === 'Other')).toBe(true);
    for (const option of options) expect(Object.keys(option).sort()).toEqual(['id', 'name']);
  });
});
