import { expect, test, type Page } from '@playwright/test';

import { FIELD_ID_NAMESPACE, seedId } from '../../prisma/seed/config/seed-sections-and-stages';
import { columnLetterToIndex } from '../../src/lib/columns';

import { useFreshAddress } from './support/auth';
import { horizontalOverflow, TOUCH_TARGET } from './support/design-system';
import { control, expectFormAccessible, isPatchOfInputs, nextSave, openForm, partForm } from './support/part-form';

/**
 * STORY-05.05 T6 (AC-1, AC-2, AC-3, AC-6; FR-048; SPEC section 14.4) at 360x800, 768x1024 and 1366x768 on the development server: Fasteners Qty (T) and Cost (U) show only when the part has
 * fasteners. They are not drawn (not just disabled) while Fasteners (S) is "None" in any letter case, with spaces around it, or blank, and then they are not counted in "n of m"; any other word shows them
 * again with the values typed earlier; the server holds 0.00 for them while they are hidden; showing and hiding them moves no focus; axe finds nothing. The rule itself and the stored values are judged
 * in `tests/unit/estimate/fasteners-save.test.ts` and `tests/integration/estimates/fasteners.test.ts`. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const FASTENERS_REGION = '05 Fasteners';
const NONE = 'None';
const NONE_SPELLINGS = ['none', ' NONE ', 'NoNe'] as const;
const WITH_FASTENERS = 'M6 bolt';
const OTHER_FASTENERS = 'Rivets';
const TYPED_QTY = '5';
const TYPED_COST = '3.5';
const SHOWN_QTY = '5.00';
const SHOWN_COST = '3.50';
const HIDDEN_NUMBER = '0.00';
const COUNT_WITHOUT_QTY_AND_COST = '1 of 1 complete';
const COUNT_WITH_QTY_AND_COST_EMPTY = '1 of 3 complete';
const COUNT_WITH_QTY_AND_COST_FILLED = '3 of 3 complete';

const region = (page: Page) => page.getByRole('region', { name: FASTENERS_REGION });
const fieldId = (letter: string): string => seedId(FIELD_ID_NAMESPACE, columnLetterToIndex(letter));

/** What the server holds of the part, by field ID (the estimate and its one part have the person's ID). */
async function storedValues(page: Page, id: string): Promise<Record<string, string>> {
  const response = await page.request.get(`/api/v1/estimates/${id}/nodes/${id}`);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { readonly inputs: ReadonlyArray<{ readonly fieldId: string; readonly value: string }> };
  return Object.fromEntries(body.inputs.map((entry) => [entry.fieldId, entry.value]));
}

/** Leaves Fasteners with the text and waits for the save that follows. */
async function saveFasteners(page: Page, text: string): Promise<void> {
  const saved = nextSave(page);
  await control(page, 'S').fill(text);
  await control(page, 'S').blur();
  expect(await saved).toBe(200);
}

test.describe('AC-1: hidden while Fasteners is "None" or blank', () => {
  test('AC-1: Qty and Cost are not on a new part (not disabled: not there), and the card counts Fasteners alone', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await expect(control(page, 'S')).toHaveValue(NONE);
    await expect(control(page, 'T')).toHaveCount(0);
    await expect(control(page, 'U')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: /Fasteners Qty/ })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: /Fasteners Cost/ })).toHaveCount(0);
    await expect(region(page)).toContainText(COUNT_WITHOUT_QTY_AND_COST);
    await expect(region(page)).not.toContainText('Fasteners Qty');
  });

  test('AC-1: "none", " NONE " and a blank keep them hidden as they are typed, and a repeat of the default sends nothing', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const requests: string[] = [];
    page.on('request', (request) => {
      if (isPatchOfInputs(request.url(), request.method())) requests.push(request.url());
    });
    for (const spelling of NONE_SPELLINGS) {
      await control(page, 'S').fill(spelling);
      await expect(control(page, 'T'), spelling).toHaveCount(0);
      await expect(control(page, 'U'), spelling).toHaveCount(0);
    }
    await control(page, 'S').fill('');
    await expect(control(page, 'T')).toHaveCount(0);
    await expect(control(page, 'U')).toHaveCount(0);
    // Left blank, the box shows its default "None" again, and nothing was stored for it.
    await control(page, 'S').blur();
    await expect(control(page, 'S')).toHaveValue(NONE);
    await expect(control(page, 'T')).toHaveCount(0);
    expect(requests).toEqual([]);
  });
});

test.describe('AC-2, AC-3: any other word shows them, with what was typed earlier; the server holds 0 while they are hidden', () => {
  test('AC-2: another word shows Qty and Cost, empty and counted; typed values are saved as two decimals', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    await saveFasteners(page, WITH_FASTENERS);
    await expect(control(page, 'T')).toBeVisible();
    await expect(control(page, 'U')).toBeVisible();
    await expect(control(page, 'T')).toHaveValue('');
    await expect(region(page)).toContainText(COUNT_WITH_QTY_AND_COST_EMPTY);
    const savedQty = nextSave(page);
    await control(page, 'T').fill(TYPED_QTY);
    await control(page, 'T').blur();
    expect(await savedQty).toBe(200);
    const savedCost = nextSave(page);
    await control(page, 'U').fill(TYPED_COST);
    await control(page, 'U').blur();
    expect(await savedCost).toBe(200);
    await expect(control(page, 'T')).toHaveValue(SHOWN_QTY);
    await expect(control(page, 'U')).toHaveValue(SHOWN_COST);
    await expect(region(page)).toContainText(COUNT_WITH_QTY_AND_COST_FILLED);
    expect(await storedValues(page, owner.id)).toMatchObject({ [fieldId('T')]: SHOWN_QTY, [fieldId('U')]: SHOWN_COST });
  });

  test('AC-2, AC-3: back to "None" hides them and the server holds 0.00; another word shows them again with what was typed, and saves it', async ({ page }, testInfo) => {
    // One of two tests that are slow by what they do (AQP-340): seven saves, four reads of the server and a reload, one after the other. Measured: 23.2 s on a mobile shard of a green run (44021154191) and
    // 22.9 s of actions in the trace of a tablet attempt that ran out of its 30 s on the slowest shard (runs 44025795508, 44045571667). Three times the default, for this test only.
    test.slow();
    const owner = await openForm(page, testInfo);
    await saveFasteners(page, WITH_FASTENERS);
    for (const [letter, typed] of [
      ['T', TYPED_QTY],
      ['U', TYPED_COST],
    ] as const) {
      const saved = nextSave(page);
      await control(page, letter).fill(typed);
      await control(page, letter).blur();
      expect(await saved).toBe(200);
    }

    await saveFasteners(page, NONE);
    await expect(control(page, 'T')).toHaveCount(0);
    await expect(control(page, 'U')).toHaveCount(0);
    await expect(region(page)).toContainText(COUNT_WITHOUT_QTY_AND_COST);
    // The rule is the server's: what it holds for them is 0.00, whatever was typed before (SPEC section 14.4).
    expect(await storedValues(page, owner.id)).toMatchObject({ [fieldId('S')]: NONE, [fieldId('T')]: HIDDEN_NUMBER, [fieldId('U')]: HIDDEN_NUMBER });

    // The values typed earlier come back with the fields, and the server is given them again, so the screen and the part agree.
    await saveFasteners(page, OTHER_FASTENERS);
    await expect(control(page, 'T')).toHaveValue(SHOWN_QTY);
    await expect(control(page, 'U')).toHaveValue(SHOWN_COST);
    await expect.poll(async () => (await storedValues(page, owner.id))[fieldId('T')]).toBe(SHOWN_QTY);
    await expect.poll(async () => (await storedValues(page, owner.id))[fieldId('U')]).toBe(SHOWN_COST);

    // After a reload the page shows what the server holds.
    await page.reload();
    await expect(control(page, 'T')).toHaveValue(SHOWN_QTY);
    await expect(control(page, 'U')).toHaveValue(SHOWN_COST);
  });

  test('AC-3: after "None" and a reload, Qty and Cost are hidden, and showing them again offers what the server holds: 0.00', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    await saveFasteners(page, WITH_FASTENERS);
    const savedQty = nextSave(page);
    await control(page, 'T').fill(TYPED_QTY);
    await control(page, 'T').blur();
    expect(await savedQty).toBe(200);
    await saveFasteners(page, NONE);
    await page.reload();
    await expect(control(page, 'S')).toHaveValue(NONE);
    await expect(control(page, 'T')).toHaveCount(0);
    await control(page, 'S').fill(OTHER_FASTENERS);
    await expect(control(page, 'T')).toHaveValue(HIDDEN_NUMBER);
    expect((await storedValues(page, owner.id))[fieldId('T')]).toBe(HIDDEN_NUMBER);
  });
});

test.describe('AC-6: the screen at 360, 768 and 1366 px', () => {
  test('AC-6: showing and hiding Qty and Cost moves no focus, Enter goes S, T, U, V, and with "None" S goes to V', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await control(page, 'S').focus();
    await control(page, 'S').fill(WITH_FASTENERS);
    await expect(control(page, 'T')).toBeVisible();
    await expect(control(page, 'S')).toBeFocused();
    await control(page, 'S').fill(NONE);
    await expect(control(page, 'T')).toHaveCount(0);
    await expect(control(page, 'S')).toBeFocused();

    await control(page, 'S').fill(WITH_FASTENERS);
    const saved = nextSave(page);
    await page.keyboard.press('Enter');
    expect(await saved).toBe(200);
    await expect(control(page, 'T')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(control(page, 'U')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(control(page, 'V')).toBeFocused();

    await control(page, 'S').fill(NONE);
    const savedNone = nextSave(page);
    await page.keyboard.press('Enter');
    expect(await savedNone).toBe(200);
    await expect(control(page, 'V')).toBeFocused();
  });

  test('AC-6: with Qty and Cost shown there is no sideways scroll, axe finds nothing, and each is 44 px high', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await expectFormAccessible(page);
    await saveFasteners(page, WITH_FASTENERS);
    await expect(partForm(page)).toBeVisible();
    await expect(control(page, 'T')).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    for (const letter of ['T', 'U']) expect((await control(page, letter).boundingBox())?.height ?? 0, letter).toBeGreaterThanOrEqual(TOUCH_TARGET);
    await expectFormAccessible(page);
    await saveFasteners(page, NONE);
    await expect(control(page, 'T')).toHaveCount(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectFormAccessible(page);
  });
});
