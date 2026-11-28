import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';

import { defined } from '../support/defined';

import { assignedEstimate } from './support/assigned-estimate';
import { E2E_ENGINEER, useFreshAddress as freshAddressFor } from './support/auth';
import { signInAs } from './support/calculated-estimate';
import { control, expectNothingUnsaved, fieldIdOf, isPatchOfInputs, isPhone, nextSave, partForm, showTree, tree, waitForForm } from './support/part-form';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * DEF-148 (AQP-505, DL-472 (4) (d), QLT-839-02 (b)): **a tree re-read must not let the next save overwrite another person's change.** Two browser contexts on one invented estimate and one part, at 360, 768 and 1366.
 * B (a second context, the same set-up Engineer) changes two fields, Length (J) and Width (K), in one save. A, who opened the part before that, has a parts tree that still shows the part as it was; A tries to
 * move the open part down, the server refuses it (the part changed, 409 `TREE_CHANGED`) and the tree is read again: it now shows the part's newer revision while A's form still holds the older values. That is the
 * state the form used to take the tree row's revision from, so A's next save went through with no 409 and the later Save draft or tab hide sent A's old texts back over B's.
 *
 * Case (i): A edits **a field B also changed** (J): the first save is answered 409, the notice "changed somewhere else" is shown, A's text is kept, B's K is shown as the server holds it, and nothing is sent
 * over B's J. Case (ii): A edits **a field B did not touch** (L): the first save is answered 409 and the form reads the part again and sends L with the new revision; there is no notice (STORY-05.08 AC-5), A's
 * form shows B's J and K, and L is stored. In both, A then presses Save draft and the tab is hidden (the keepalive flush), and the part is read through the API: B's J and K are still what B stored.
 *
 * **The person ledger is +0 (DL-422):** no person is made; the set-up's Lead makes the task and a second part through the API, and the set-up's Engineer is A and B. Every name and value is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ context }) => {
  test.setTimeout(60_000);
  await freshAddressFor(context);
});

const HEADERS = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };
const DRAFT_SAVED = /^Draft saved at \d{2}:\d{2} IST\.$/;
const TREE_CHANGED = 'The parts were changed by someone else. The tree has been refreshed. Check it and try again.';
const PART_CHANGED = 'This part was changed somewhere else.';

/** The tab becomes hidden: what the page asks for a flush on (STORY-05.10 AC-7a). */
const tabHidden = (page: Page): Promise<void> =>
  page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });

interface World {
  readonly code: string;
  readonly estimateId: string;
  readonly partId: string;
}

/** A task of the set-up Engineer with a Main Assembly and two Parts under it (1.1 and 1.2: a part can only be moved when it has a sibling), made through the API by the set-up Lead. */
async function twoPartEstimate(page: Page, testInfo: TestInfo): Promise<World> {
  const { code, estimateId } = await assignedEstimate(page, testInfo, false);
  const nodes = async (): Promise<ReadonlyArray<{ id: string; slNo: string }>> => ((await (await page.request.get(`${DEVELOPMENT_URL}/api/v1/estimates/${estimateId}/tree`)).json()) as { nodes: ReadonlyArray<{ id: string; slNo: string }> }).nodes;
  const main = defined((await nodes()).find((node) => node.slNo === '1'));
  const added = await page.request.post(`${DEVELOPMENT_URL}/api/v1/estimates/${estimateId}/nodes`, { headers: HEADERS, data: { parentId: main.id, nodeKind: 'PART' } });
  expect(added.status()).toBe(201);
  const part = defined((await nodes()).find((node) => node.slNo === '1.1'));
  return { code, estimateId, partId: part.id };
}

/** The row of part 1.1 in the parts tree. */
const row = (page: Page) => tree(page).getByRole('link').filter({ has: page.locator('[data-sl-no]', { hasText: /^1\.1$/ }) });

/** The Engineer opens part 1.1 (the form shows the tree's first row, the Main Assembly, until another is chosen) and waits until its values are read. */
async function openPart(page: Page, world: World): Promise<void> {
  await page.goto(`/estimates/${world.code}`);
  await showTree(page);
  const read = page.waitForResponse((response) => response.url().endsWith(`/nodes/${world.partId}`) && response.request().method() === 'GET');
  await row(page).click();
  // In the phone drawer a press on a row opens it: the drawer closes and the form shows.
  if (isPhone(page)) await expect(tree(page)).toBeHidden();
  expect((await read).status(), "the part's values are read").toBe(200);
  await waitForForm(page);
  await expect(page.locator('[data-part-ghost]')).toHaveCount(0);
}

/** What the server holds for the part, read through the API as the signed-in person: its revision and the value of each field by field ID. */
async function serverPart(page: Page, world: World): Promise<{ readonly revision: number; readonly values: Readonly<Record<string, string>> }> {
  const answer = await page.request.get(`${DEVELOPMENT_URL}/api/v1/estimates/${world.estimateId}/nodes/${world.partId}`);
  expect(answer.status()).toBe(200);
  const body = (await answer.json()) as { revision: number; inputs: ReadonlyArray<{ fieldId: string; value: string }> };
  return { revision: body.revision, values: Object.fromEntries(body.inputs.map((input) => [input.fieldId, input.value])) };
}

/** B, a second browser context of the same set-up Engineer, changes J to 3.00 and K to 4.00 in one save. Answers the revision the part had before. */
async function otherPersonChangesTwoFields(browser: Browser, testInfo: TestInfo, world: World): Promise<number> {
  const { baseURL, viewport, hasTouch } = testInfo.project.use;
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, ...(baseURL === undefined ? {} : { baseURL }), ...(viewport === undefined ? {} : { viewport }), ...(hasTouch === undefined ? {} : { hasTouch }) });
  try {
    await freshAddressFor(context);
    const other = await context.newPage();
    await signInAs(other, E2E_ENGINEER);
    const before = (await serverPart(other, world)).revision;
    const saved = await other.request.patch(`${DEVELOPMENT_URL}/api/v1/estimates/${world.estimateId}/nodes/${world.partId}/inputs`, {
      headers: HEADERS,
      data: { revision: before, values: { [fieldIdOf('J')]: '3.00', [fieldIdOf('K')]: '4.00' } },
    });
    expect(saved.status(), "B's save").toBe(200);
    return before;
  } finally {
    await context.close();
  }
}

/**
 * A moves the open part down. A's tree shows the part as it was, so the server refuses the move (the part changed, 409) and answers the tree as it is now: the tree is read again and shows the part's newer
 * revision, while A's form still holds the older values.
 */
async function treeIsReadAgain(page: Page): Promise<void> {
  await showTree(page);
  await row(page).click();
  if (isPhone(page)) {
    await expect(tree(page)).toBeHidden();
    await showTree(page);
  }
  const moved = page.waitForResponse((response) => response.url().endsWith('/tree/move') && response.request().method() === 'POST');
  await tree(page).getByRole('button', { name: /^Move 1\.1 / }).click();
  await page.getByRole('menuitem', { name: 'Move down', exact: true }).click();
  expect((await moved).status(), "the tree's move of the part A has not seen change").toBe(409);
  await expect(page.getByText(TREE_CHANGED).first()).toBeVisible();
  // On a phone the form is behind the drawer: a press on the open row closes it.
  if (isPhone(page)) {
    await row(page).click();
    await expect(tree(page)).toBeHidden();
  }
}

/** The saves this page sends: the revision each carries and the fields it holds. */
function recordSaves(page: Page): ReadonlyArray<{ readonly revision: number; readonly fields: ReadonlyArray<string> }> {
  const saves: Array<{ revision: number; fields: string[] }> = [];
  page.on('request', (request) => {
    if (!isPatchOfInputs(request.url(), request.method())) return;
    const body = request.postDataJSON() as { revision: number; values: Record<string, string> };
    saves.push({ revision: body.revision, fields: Object.keys(body.values) });
  });
  return saves;
}

/** Save draft, then the tab becomes hidden, then a request that the page makes after both (so anything either of them queued has been sent by then). */
async function saveDraftAndHideTab(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await tabHidden(page);
  expect(await page.evaluate(() => window.fetch('/api/v1/options/materials').then((answer) => answer.status))).toBe(200);
}

test.describe('DEF-148: two browser contexts, the tree read again after the other person changed the open part', () => {
  test("(i) A edits a field B also changed: the 409 notice, A's text kept, B's other field shown, and nothing of B's is overwritten by Save draft or a tab hide", async ({ page, browser }, testInfo) => {
    const world = await twoPartEstimate(page, testInfo);
    await signInAs(page, E2E_ENGINEER);
    await openPart(page, world);
    const saves = recordSaves(page);
    const before = await otherPersonChangesTwoFields(browser, testInfo, world);
    await treeIsReadAgain(page);

    const status = nextSave(page, 'J');
    await control(page, 'J').fill('7');
    await control(page, 'J').blur();
    expect(await status, "A's first save carries the revision of the values A holds").toBe(409);
    await expect(page.getByRole('alert').filter({ hasText: PART_CHANGED })).toBeVisible();
    await expect(partForm(page).getByText('Changed somewhere else. The newer value is "3.00".')).toBeVisible();
    await expect(control(page, 'J')).toHaveValue('7.00');
    await expect(control(page, 'K')).toHaveValue('4.00');

    await saveDraftAndHideTab(page);
    await expect(page.getByRole('alert').filter({ hasText: 'The draft was not saved.' })).toBeVisible();
    const held = await serverPart(page, world);
    expect(held.values[fieldIdOf('J')]).toBe('3.00');
    expect(held.values[fieldIdOf('K')]).toBe('4.00');
    expect(saves).toEqual([{ revision: before, fields: [fieldIdOf('J')] }]);
  });

  test("(ii) A edits a field B did not touch: a 409 and a silent re-read, no notice, A's form shows B's J and K, L is stored, and Save draft or a tab hide send nothing over B's values", async ({ page, browser }, testInfo) => {
    const world = await twoPartEstimate(page, testInfo);
    await signInAs(page, E2E_ENGINEER);
    await openPart(page, world);
    const saves = recordSaves(page);
    const before = await otherPersonChangesTwoFields(browser, testInfo, world);
    await treeIsReadAgain(page);

    const status = nextSave(page, 'L');
    await control(page, 'L').fill('5');
    await control(page, 'L').blur();
    expect(await status, "A's first save carries the revision of the values A holds").toBe(409);
    await expect(control(page, 'J')).toHaveValue('3.00');
    await expect(control(page, 'K')).toHaveValue('4.00');
    await expectNothingUnsaved(page);
    await expect(page.getByRole('alert').filter({ hasText: PART_CHANGED })).toHaveCount(0);
    await expect(control(page, 'L')).toHaveValue('5.00');

    await saveDraftAndHideTab(page);
    await expect(page.locator('[data-draft-status]')).toHaveText(DRAFT_SAVED);
    const held = await serverPart(page, world);
    expect(held.values[fieldIdOf('J')]).toBe('3.00');
    expect(held.values[fieldIdOf('K')]).toBe('4.00');
    expect(held.values[fieldIdOf('L')]).toBe('5.00');
    // The refused save, then the same value with the revision B's save made: nothing else was sent.
    expect(saves).toEqual([
      { revision: before, fields: [fieldIdOf('L')] },
      { revision: before + 1, fields: [fieldIdOf('L')] },
    ]);
  });
});
