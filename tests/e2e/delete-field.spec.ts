import { expect, test, type Locator, type Page } from '@playwright/test';

import { FIELD_ID_NAMESPACE, seedId } from '../../prisma/seed/config/seed-sections-and-stages';
import { columnLetterToIndex } from '../../src/lib/columns';

import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE } from './support/servers';

/**
 * STORY-08.04 (AC-1 to AC-4, AC-10; FR-075, FR-076, FR-080; NFR-016 to NFR-018): the delete dialog of SCR-20 over SCR-17 at 360x800, 768x1024 and 1366x768 on the development server, as the E2E Admin (the saved browser
 * state of the set-up project). The words are the UX spec's and the story's, written out here and not imported. Each case opens one page and scans axe at most once.
 *
 * What is checked: a field that something uses opens "Blocked by formulas" (the references read is real) with the list of formulas, an Edit link to SCR-18 that the keyboard reaches, no password field, focus on the
 * safe button, and Escape giving focus back to the row's Delete; a field nothing uses opens the confirm state with a labelled password field and a hint, the safe button holding focus, a wrong password announced under
 * the field (emptied, focus back on it), and a right one closing the dialog with the sentence above the list and focus on the page heading; a field that something started to use while the dialog was open turns into the
 * blocked list. The references reads are real (they store nothing); **the delete is answered by the test, never stored**: the three projects share one database, and a real delete would move every letter, and
 * wrong passwords would count against the one Admin's step-up for every other spec. The real delete, the order of the refusals, one version and its audit entry, the throttle and the races are
 * `tests/integration/config/delete-field.test.ts` and `tests/unit/config-delete-routes.test.ts`. The lock tags and the Delete on the other rows are `config-fields.spec.ts`.
 */

const fieldIdOf = (letter: string): string => seedId(FIELD_ID_NAMESPACE, columnLetterToIndex(letter));
const PART_NO_ID = fieldIdOf('B');
const WRONG = 'Not-the-right-1!';
const RIGHT = 'Invented-right-password-1';

const rowOf = (page: Page, letter: string): Locator => page.locator('[data-field-id]:visible').filter({ has: page.getByText(`Excel column ${letter}`, { exact: true }) });
const deleteButton = (page: Page, letter: string): Locator => rowOf(page, letter).getByRole('button', { name: /^Delete/ });
const dialogOf = (page: Page): Locator => page.getByRole('alertdialog');

/** SCR-17 by its address, then its first read, then React's handlers on the controls (a press before that is lost). */
async function openFields(page: Page): Promise<void> {
  await page.goto('/config/fields');
  await expect(page.getByRole('heading', { level: 1, name: 'Fields and formulas' })).toBeVisible();
  await waitUntilHydrated(page, '#field-kind', 'onChange');
  await expect(page.locator('[data-field-id]:visible').first()).toBeVisible();
}

interface DeleteAnswer {
  readonly status: number;
  readonly body: unknown;
}

const WRONG_PASSWORD: DeleteAnswer = { status: 422, body: { type: 'about:blank', title: 'That password is not correct.', status: 422, code: 'STEP_UP_FAILED', requestId: 'req-00000000' } };
const DELETED: DeleteAnswer = { status: 200, body: { version: 99, message: 'Field deleted. Configuration version 99.' } };

/** Answers the delete of one field (`DELETE /api/v1/config/fields/{id}`) and nothing else; the references read goes to the real server. The answers are given in turn, the last one repeating. Returns what the browser sent. */
async function answerDelete(page: Page, fieldId: string, answers: ReadonlyArray<DeleteAnswer>): Promise<{ readonly sent: unknown[] }> {
  const sent: unknown[] = [];
  await page.route(`**/api/v1/config/fields/${fieldId}`, async (route) => {
    if (route.request().method() !== 'DELETE') return route.continue();
    sent.push(route.request().postDataJSON());
    const answer = answers[Math.min(sent.length, answers.length) - 1];
    return route.fulfill({ status: answer?.status ?? 500, contentType: (answer?.status ?? 500) === 200 ? 'application/json' : 'application/problem+json', body: JSON.stringify(answer?.body ?? {}) });
  });
  return { sent };
}

test.describe('the Admin', () => {
  test.use({ storageState: ADMIN_STATE });

  test('AC-1, AC-2, AC-10: a field a formula uses opens "Blocked by formulas": the list, an Edit link the keyboard reaches, no password field, focus on the safe button, Escape back to the row; no sideways scroll, axe 0', async ({ page }) => {
    await openFields(page);
    await deleteButton(page, 'AL').click();
    const dialog = dialogOf(page);
    await expect(dialog.getByRole('heading', { name: 'Cannot delete AL Cutting Cost yet.' })).toBeVisible();
    await expect(dialog).toContainText(/formulas? use(s)? this field\.|places? use(s)? this field\./);

    // The blocked list is a real list: Total Process Cost (AY) adds Cutting Cost, so it is the first, with its formula and an Edit link to SCR-18.
    const list = dialog.getByRole('list', { name: 'What uses this field' });
    const first = list.getByRole('listitem').first();
    await expect(first).toContainText('AY');
    await expect(first.getByRole('link', { name: /^Edit AY/ })).toHaveAttribute('href', `/config/fields/${fieldIdOf('AY')}/formula`);
    await expect(dialog.getByLabel('Your password')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Delete field' })).toHaveCount(0);

    // The safe button holds focus (and is "Close" now that there is nothing to confirm); Tab goes on to the first Edit link, so the links are keyboard-operable.
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(list.getByRole('link').first()).toBeFocused();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(deleteButton(page, 'AL')).toBeFocused();
  });

  test('AC-3, AC-4, AC-10: a field nothing uses opens the confirm state with a labelled password and a hint, the safe button holding focus; a wrong password is announced under the field, emptied, with focus back on it; the right one closes the dialog with the sentence and focus on the heading; axe 0', async ({ page }) => {
    const { sent } = await answerDelete(page, PART_NO_ID, [WRONG_PASSWORD, DELETED]);
    await openFields(page);
    await deleteButton(page, 'B').click();
    const dialog = dialogOf(page);
    await expect(dialog.getByRole('heading', { name: 'Delete B Part No.?' })).toBeVisible();
    await expect(dialog).toContainText('No formula uses this field. Deleting it moves every later field one letter to the left.');
    const password = dialog.getByLabel('Your password');
    await expect(password).toBeVisible();
    await expect(password).toHaveAttribute('aria-describedby', /delete-field-password-hint/);
    await expect(dialog.getByRole('button', { name: 'Keep the field' })).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Delete field' })).toBeDisabled();

    // A wrong password: the server's sentence and what to do, under the field, which is empty and has focus again; nothing was deleted and the dialog stays.
    await password.fill(WRONG);
    await dialog.getByRole('button', { name: 'Delete field' }).click();
    await expect(dialog.getByText('That password is not correct. Try again.')).toBeVisible();
    await expect(password).toBeFocused();
    await expect(password).toHaveValue('');
    expect(sent).toEqual([{ password: WRONG }]);
    await expectNoAxeViolations(page);

    // The right one, sent with Enter: the dialog closes, the sentence shows above the list, and focus is on the page heading (the row is gone with the field).
    await password.fill(RIGHT);
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Field deleted. Configuration version 99.')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Fields and formulas' })).toBeFocused();
    expect(sent).toEqual([{ password: WRONG }, { password: RIGHT }]);
  });

  test('AC-2: a field that a formula started to use while the dialog was open turns the confirm state into the blocked list, with the server\'s uses and an Edit link', async ({ page }) => {
    const blocked: DeleteAnswer = {
      status: 409,
      body: {
        type: 'about:blank',
        title: 'Cannot delete B Part No. yet. 1 formula uses this field.',
        status: 409,
        code: 'FIELD_IN_USE',
        requestId: 'req-00000001',
        uses: [{ kind: 'formula', fieldId: fieldIdOf('AY'), letter: 'AY', label: 'Total Process Cost', formula: 'AL + B' }],
      },
    };
    await answerDelete(page, PART_NO_ID, [blocked]);
    await openFields(page);
    await deleteButton(page, 'B').click();
    const dialog = dialogOf(page);
    await dialog.getByLabel('Your password').fill(RIGHT);
    await dialog.getByRole('button', { name: 'Delete field' }).click();
    await expect(dialog.getByRole('heading', { name: 'Cannot delete B Part No. yet.' })).toBeVisible();
    await expect(dialog.getByRole('list', { name: 'What uses this field' }).getByRole('link', { name: /^Edit AY/ })).toBeVisible();
    await expect(dialog.getByLabel('Your password')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible();
  });
});
