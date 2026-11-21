import { expect, test, type Locator, type Page } from '@playwright/test';

import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE, SIGNED_IN_STATE } from './support/servers';

/**
 * STORY-08.06 (AC-2 to AC-4, AC-7, AC-9, AC-10; FR-077, FR-078, FR-080; NFR-016 to NFR-018): SCR-21 "Checkpoints and versions" at 360x800, 768x1024 and 1366x768 on the development server, as the E2E Admin (the saved
 * browser state of the set-up project). The words are the UX spec's and the story's, written out here and not imported. Each case opens one page and scans axe at most once.
 *
 * What is checked: the Default state (the current configuration card, the list newest first, a Revert on every row but the one that names the current version, the table inside its own named focusable region from 768 px
 * and cards below it, no sideways scroll, axe 0); Name missing (the sentence under the field, no request sent); Saved and a name that is taken; the revert dialog (an alertdialog that says what happens, a labelled
 * password with a hint, the safe button holding focus, a wrong password announced under the field and emptied, a right one closing the dialog with the sentence and the undo, focus on the page heading); the undo
 * (a revert like any other, the password asked again, on the version the revert made); the keyboard; Loading, Error with "Try again", and Empty; and the Lead, who is refused (403) on the page and on all three routes.
 *
 * **The lists and the writes are answered by the test, never stored**: the three projects share one database, a real save or revert would add a version and a checkpoint every other spec sees, and wrong passwords would
 * count against the one Admin's step-up for every other spec. The real list, save, revert, the order of the refusals, the audit entry, the throttle and the races are
 * `tests/integration/config/checkpoints-revert.test.ts` and `tests/unit/config-checkpoint-routes.test.ts`; that a revert leaves every estimate as it was is `checkpoints-estimates.test.ts`.
 */

const WRONG = 'Not-the-right-1!';
const RIGHT = 'Invented-right-password-1';
const id = (n: number): string => `00000000-0000-4000-8000-0ddd${String(n).padStart(8, '0')}`;
const versionId = (n: number): string => `00000000-0000-4000-8000-0ccc${String(n).padStart(8, '0')}`;

/** The mock-up's own story: "Before AY insert" is version 7, a formula edit made version 8, a revert made version 9, which is current; a revert now would make version 10. Newest first. */
const ROWS = [
  { id: id(3), name: 'After rework column', versionId: versionId(9), versionNumber: 9, savedAt: '2026-11-02T06:00:00.000Z', savedBy: 'Meera Iyer' },
  { id: id(2), name: 'Before AY insert', versionId: versionId(7), versionNumber: 7, savedAt: '2026-11-01T11:30:00.000Z', savedBy: 'Meera Iyer' },
  { id: id(1), name: 'Original configuration', versionId: versionId(1), versionNumber: 1, savedAt: '2026-10-20T04:30:00.000Z', savedBy: null },
];
const CURRENT = { number: 9, savedBy: 'Meera Iyer', savedAt: '2026-11-02T06:00:00.000Z', estimatesInUse: 3 };

interface Answer {
  readonly status: number;
  readonly body: unknown;
}

const problem = (status: number, code: string, title: string): Answer => ({ status, body: { type: 'about:blank', title, status, code, requestId: 'req-00000000' } });
const WRONG_PASSWORD = problem(422, 'STEP_UP_FAILED', 'That password is not correct.');
const NAME_TAKEN = problem(409, 'CHECKPOINT_NAME_TAKEN', 'A checkpoint with this name already exists. Names must be unique.');
const REVERTED: Answer = { status: 200, body: { version: 10, copiedFrom: 7, undoVersionId: versionId(9) } };

const fulfil = (route: Parameters<Parameters<Page['route']>[1]>[0], answer: Answer) =>
  route.fulfill({ status: answer.status, contentType: answer.status < 300 ? 'application/json' : 'application/problem+json', body: JSON.stringify(answer.body) });

/** Answers the two reads (`GET /config/checkpoints`, `GET /config/current`) with the mock-up's data; `list` may be another answer, and `delayMs` holds the list back. */
async function answerReads(page: Page, options: { readonly list?: Answer | ReadonlyArray<Answer>; readonly delayMs?: number } = {}): Promise<{ readonly reads: { count: number; failing: boolean } }> {
  // `failing` answers every list read with a server error until the test turns it off (the dev server reads twice on mount, so "the first read fails" would not hold).
  const reads = { count: 0, failing: false };
  const lists = options.list === undefined ? [{ status: 200, body: { checkpoints: ROWS } }] : Array.isArray(options.list) ? options.list : [options.list];
  await page.route('**/api/v1/config/current', (route) => fulfil(route, { status: 200, body: CURRENT }));
  await page.route('**/api/v1/config/checkpoints', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    reads.count += 1;
    if (reads.failing) return fulfil(route, { status: 500, body: {} });
    if (options.delayMs !== undefined) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    return fulfil(route, lists[Math.min(reads.count, lists.length) - 1] ?? { status: 500, body: {} });
  });
  return { reads };
}

/** Answers the save (`POST /config/checkpoints`) in turn, the last answer repeating. Returns what the browser sent. */
async function answerSave(page: Page, answers: ReadonlyArray<Answer>): Promise<{ readonly sent: unknown[] }> {
  const sent: unknown[] = [];
  await page.route('**/api/v1/config/checkpoints', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    sent.push(route.request().postDataJSON());
    return fulfil(route, answers[Math.min(sent.length, answers.length) - 1] ?? { status: 500, body: {} });
  });
  return { sent };
}

/** Answers the revert (`POST /config/versions/{id}/revert`) in turn, the last answer repeating. Returns the path and body of each request. */
async function answerRevert(page: Page, answers: ReadonlyArray<Answer>): Promise<{ readonly sent: Array<{ readonly path: string; readonly body: unknown }> }> {
  const sent: Array<{ path: string; body: unknown }> = [];
  await page.route('**/api/v1/config/versions/*/revert', (route) => {
    sent.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() });
    return fulfil(route, answers[Math.min(sent.length, answers.length) - 1] ?? { status: 500, body: {} });
  });
  return { sent };
}

const dialogOf = (page: Page): Locator => page.getByRole('alertdialog');
const revertButton = (page: Page, name: string): Locator => page.getByRole('button', { name: `Revert to ${name}` });

/** SCR-21 by its address, then its first reads, then React's handlers on the controls (a press before that is lost). */
async function openCheckpoints(page: Page): Promise<void> {
  await page.goto('/config/checkpoints');
  await expect(page.getByRole('heading', { level: 1, name: 'Checkpoints and versions' })).toBeVisible();
  await waitUntilHydrated(page, '#checkpoint-name', 'onChange');
  await expect(page.locator('[data-item-id]:visible').filter({ hasText: 'Before AY insert' }).first()).toBeVisible();
}

test.describe('the Admin', () => {
  test.use({ storageState: ADMIN_STATE });

  test('AC-3, AC-10: the Default state shows the current configuration, the list newest first with a Revert on every row but the current one, the table in its own named region or cards on a phone; no sideways scroll, axe 0', async ({ page }, testInfo) => {
    await answerReads(page);
    await openCheckpoints(page);
    await expect(page.getByRole('heading', { name: 'Current configuration' })).toBeVisible();
    await expect(page.getByRole('term').filter({ hasText: 'Version' })).toBeVisible();
    await expect(page.getByText('02 Nov 2026, 11:30 IST by Meera Iyer')).toBeVisible();
    await expect(page.getByText('3 estimates')).toBeVisible();

    // Newest first; the row that names version 9 has the tag "Current" and no Revert, the others have a Revert named for the checkpoint.
    const names = page.locator('[data-item-id]:visible').getByText(/^(After rework column|Before AY insert|Original configuration)$/);
    await expect(names).toHaveText(['After rework column', 'Before AY insert', 'Original configuration']);
    await expect(revertButton(page, 'After rework column')).toHaveCount(0);
    await expect(revertButton(page, 'Before AY insert')).toBeVisible();
    await expect(revertButton(page, 'Original configuration')).toBeVisible();
    await expect(page.locator('[data-item-id]:visible').getByText('Current', { exact: true })).toBeVisible();
    // The seed checkpoint has no person.
    await expect(page.locator('[data-item-id]:visible').filter({ hasText: 'Original configuration' })).toContainText('No person');

    const wide = (testInfo.project.use.viewport?.width ?? 0) >= 768;
    if (wide) await expect(page.getByRole('region', { name: 'Saved checkpoints, scrollable' })).toHaveAttribute('tabindex', '0');
    else await expect(page.getByRole('list', { name: 'Saved checkpoints' })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-2, AC-10: Name missing says "Enter a name for this checkpoint." under the field, puts focus on it and sends nothing', async ({ page }) => {
    await answerReads(page);
    const { sent } = await answerSave(page, [{ status: 201, body: ROWS[1] }]);
    await openCheckpoints(page);
    await page.getByRole('button', { name: 'Save checkpoint' }).click();
    const field = page.getByLabel('Save as a checkpoint');
    await expect(page.getByText('Enter a name for this checkpoint.')).toBeVisible();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toBeFocused();
    expect(sent).toEqual([]);
  });

  test('AC-2, AC-10: a name that is taken is the server\'s sentence under the field; the next try is saved, announced politely, and the field is emptied', async ({ page }) => {
    await answerReads(page);
    const { sent } = await answerSave(page, [NAME_TAKEN, { status: 201, body: { ...ROWS[1], name: 'After rework column 2' } }]);
    await openCheckpoints(page);
    const field = page.getByLabel('Save as a checkpoint');
    await field.fill('  after rework   column ');
    await page.getByRole('button', { name: 'Save checkpoint' }).click();
    await expect(page.getByText('A checkpoint with this name already exists. Names must be unique.')).toBeVisible();
    await expect(field).toBeFocused();
    // The name is sent trimmed and with single spaces, so the server compares what will be stored.
    expect(sent).toEqual([{ name: 'after rework column' }]);

    await field.fill('After rework column 2');
    await page.getByRole('button', { name: 'Save checkpoint' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Checkpoint "After rework column 2" saved.' })).toBeVisible();
    await expect(field).toHaveValue('');
    expect(sent).toEqual([{ name: 'after rework column' }, { name: 'After rework column 2' }]);
  });

  test('AC-4, AC-7, AC-10: Revert opens an alertdialog that says what happens, with a labelled password; a wrong password is announced under the field, emptied, with focus back on it; the right one closes the dialog with the sentence, the undo and focus on the heading; axe 0', async ({ page }) => {
    await answerReads(page);
    const { sent } = await answerRevert(page, [WRONG_PASSWORD, REVERTED]);
    await openCheckpoints(page);
    await revertButton(page, 'Before AY insert').click();
    const dialog = dialogOf(page);
    await expect(dialog.getByRole('heading', { name: 'Revert to "Before AY insert"?' })).toBeVisible();
    await expect(dialog).toContainText('This makes a new configuration version (version 10) that is a copy of version 7.');
    const effects = dialog.getByRole('list', { name: 'What a revert does' });
    await expect(effects.getByRole('listitem')).toHaveText([
      'Estimate data is not touched.',
      'Approved estimates keep the layout and values they were approved with.',
      'A draft estimate uses the reverted layout from its next calculation.',
      'You can undo it: the version you are on now stays in the history.',
    ]);
    const password = dialog.getByLabel('Your password');
    await expect(password).toHaveAttribute('aria-describedby', /revert-password-hint/);
    await expect(dialog.getByRole('button', { name: 'Keep the current version' })).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Revert', exact: true })).toBeDisabled();

    // A wrong password: the server's sentence and what to do, under the field, which is empty and has focus again; nothing changed and the dialog stays.
    await password.fill(WRONG);
    await dialog.getByRole('button', { name: 'Revert', exact: true }).click();
    await expect(dialog.getByText('That password is not correct. Try again.')).toBeVisible();
    await expect(password).toBeFocused();
    await expect(password).toHaveValue('');
    expect(sent.map((request) => request.body)).toEqual([{ password: WRONG, baseVersion: 9 }]);
    expect(sent[0]?.path).toBe(`/api/v1/config/versions/${versionId(7)}/revert`);
    await expectNoAxeViolations(page);

    // The right one, sent with Enter: the dialog closes, the success sentence and the undo show above the cards, and focus is on the page heading.
    await password.fill(RIGHT);
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Reverted to version 7. This is now configuration version 10.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Revert to the version from before' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Checkpoints and versions' })).toBeFocused();
    expect(sent.map((request) => request.body)).toEqual([{ password: WRONG, baseVersion: 9 }, { password: RIGHT, baseVersion: 9 }]);
  });

  test('AC-7: "Revert to the version from before" is a revert like any other: the dialog is for the version that was latest before, the password is asked again, and it is sent on the version the revert made', async ({ page }) => {
    await answerReads(page);
    const { sent } = await answerRevert(page, [REVERTED, { status: 200, body: { version: 11, copiedFrom: 9, undoVersionId: versionId(10) } }]);
    await openCheckpoints(page);
    await revertButton(page, 'Before AY insert').click();
    await dialogOf(page).getByLabel('Your password').fill(RIGHT);
    await dialogOf(page).getByRole('button', { name: 'Revert', exact: true }).click();
    await page.getByRole('button', { name: 'Revert to the version from before' }).click();
    const dialog = dialogOf(page);
    await expect(dialog.getByRole('heading', { name: 'Revert to version 9?' })).toBeVisible();
    await expect(dialog).toContainText('This makes a new configuration version (version 11) that is a copy of version 9.');
    await expect(dialog.getByLabel('Your password')).toHaveValue('');
    await dialog.getByLabel('Your password').fill(RIGHT);
    await dialog.getByRole('button', { name: 'Revert', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Reverted to version 9. This is now configuration version 11.' })).toBeVisible();
    // The first revert was made on version 9 (the one the screen showed); the undo on 10 (the one the first revert made).
    expect(sent.map((request) => request.body)).toEqual([{ password: RIGHT, baseVersion: 9 }, { password: RIGHT, baseVersion: 10 }]);
    expect(sent[1]?.path).toBe(`/api/v1/config/versions/${versionId(9)}/revert`);
  });

  test('AC-10: keyboard only: Revert opens with Enter, the safe button holds focus, and Escape closes with nothing sent and focus back on the Revert that opened it', async ({ page }) => {
    await answerReads(page);
    const { sent } = await answerRevert(page, [REVERTED]);
    await openCheckpoints(page);
    const button = revertButton(page, 'Before AY insert');
    await button.focus();
    await page.keyboard.press('Enter');
    const dialog = dialogOf(page);
    await expect(dialog.getByRole('button', { name: 'Keep the current version' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(button).toBeFocused();
    expect(sent).toEqual([]);
  });

  test('AC-10: Loading shows a polite status while the list is on its way, then the Empty state "No checkpoints yet"', async ({ page }) => {
    await answerReads(page, { list: { status: 200, body: { checkpoints: [] } }, delayMs: 900 });
    await page.goto('/config/checkpoints');
    await expect(page.getByRole('heading', { level: 1, name: 'Checkpoints and versions' })).toBeVisible();
    await expect(page.getByText('Loading checkpoints')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No checkpoints yet' })).toBeVisible();
    await expect(page.getByText('Save one before you change formulas, so you can go back.')).toBeVisible();
  });

  test('AC-10: Error shows "We could not load the checkpoints" with "Try again", which reads again and shows the list', async ({ page }) => {
    const { reads } = await answerReads(page);
    reads.failing = true;
    await page.goto('/config/checkpoints');
    await expect(page.getByRole('heading', { name: 'We could not load the checkpoints' })).toBeVisible();
    reads.failing = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('[data-item-id]:visible').filter({ hasText: 'Before AY insert' }).first()).toBeVisible();
  });
});

test.describe('the Lead', () => {
  test.use({ storageState: SIGNED_IN_STATE });

  test('AC-9: is refused (403) on the page and on all three routes, and the menu offers no Checkpoints', async ({ page }) => {
    await page.goto('/config/fields');
    await expect(page.getByText('View only.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Checkpoints' })).toHaveCount(0);
    const refusedPage = await page.goto('/config/checkpoints');
    expect(refusedPage?.status()).toBe(403);
    const origin = new URL(page.url()).origin;
    expect((await page.request.get('/api/v1/config/checkpoints')).status()).toBe(403);
    expect((await page.request.post('/api/v1/config/checkpoints', { headers: { origin }, data: { name: 'Invented' } })).status()).toBe(403);
    expect((await page.request.post(`/api/v1/config/versions/${versionId(1)}/revert`, { headers: { origin }, data: { password: RIGHT, baseVersion: 1 } })).status()).toBe(403);
  });
});
