import { expect, test, type Locator, type Page } from '@playwright/test';

import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { defined } from '../support/defined';
import { canaryTaskCodeFor } from '../support/estimate-recipe';

import { connectToTestDatabase, ensureCanaryCustomers, setCanaryCustomer } from './support/auth';
import { waitUntilHydrated } from './support/design-system';
import { control, fieldIdOf, isPhone, nextSave, revealRowToolbar, signInAsNewEngineer, tree } from './support/part-form';

/**
 * AQP-446 (DEF-089) and AQP-447 (DEF-090): the parts tree shows each row's kind and name as SCR-05 draws them, and a row is named through its Description (UX ruling
 * `docs/03-ux/rulings/parts-tree-scr05-conformance-2026-11-26.md`, checks NAME-1 to NAME-5, KIND-1; master's DL-413: after an add the focus is on the new row's link and Enter moves into the form). One test per
 * width on the development server: a person of its own with a tree of the five kinds made in the database (a Main Assembly, a Sub-Assembly, two Parts that are therefore Sub-parts, and a Fastener), one row
 * named by its Description and one by its Part No., then one row added with the "+", named through its Description and checked in the tree and in the server's answer. On a phone the tree is the drawer, so the
 * helpers open it when they must read the tree. Every name is invented.
 */

const row = (page: Page, slNo: string): Locator => tree(page).getByRole('link').filter({ has: page.locator('[data-sl-no]', { hasText: new RegExp(`^${slNo.replaceAll('.', '\\.')}$`) }) });
/** The name of a row: the text after its number, which is what a person reads (the kind icon's own name is a tooltip and a spoken name, not this text). */
const nameOf = (page: Page, slNo: string): Locator => row(page, slNo).locator('[data-sl-no] + span');
const rowButton = (page: Page, words: string, slNo: string): Locator => tree(page).getByRole('button', { name: new RegExp(`^${words} ${slNo.replaceAll('.', '\\.')} `) });

/** The tree is on screen: from 768 px it always is; on a phone it is the drawer, opened by its button when it is shut. */
async function showTree(page: Page): Promise<void> {
  if (isPhone(page) && !(await tree(page).isVisible())) await page.getByRole('button', { name: /^Parts tree/ }).click();
  await expect(tree(page)).toBeVisible();
}

/** The rows of the five kinds under the person's one Main Assembly (its ID is the person's), with a Part No. on one Part and a Description on the other. They are inserted before the page is opened. */
async function insertKindedRows(ownerId: string): Promise<void> {
  const client = await connectToTestDatabase();
  try {
    const insert = async (parentId: string, sortIndex: number, kind: string, inputs: Record<string, string>): Promise<string> => {
      const made = await client.query<{ id: string }>(
        'INSERT INTO estimate_nodes (estimate_id, parent_id, sort_index, node_kind, inputs) VALUES ($1::uuid, $2::uuid, $3, $4::estimate_node_kind, $5::jsonb) RETURNING id::text',
        [ownerId, parentId, sortIndex, kind, JSON.stringify(inputs)],
      );
      return made.rows[0]?.id ?? '';
    };
    await insert(ownerId, 0, 'SUB_ASSEMBLY', {});
    await insert(ownerId, 1, 'PART', { [fieldIdOf('B')]: 'XP-1101' });
    const named = await insert(ownerId, 2, 'PART', { [fieldIdOf('D')]: 'Base frame', [fieldIdOf('B')]: 'XP-9' });
    await insert(named, 0, 'FASTENER', {});
  } finally {
    await client.end();
  }
}

test.use({ storageState: { cookies: [], origins: [] } });

test('NAME-1 to NAME-4, KIND-1: rows show their kind and their name; a new row is named through its Description and the tree follows when the field is left', async ({ page }, testInfo) => {
  await ensureCanaryCustomers();
  const owner = await signInAsNewEngineer(page, testInfo);
  // The customer and the rows are set in the database before the page is opened, as a task is assigned with one (CR-01 item 6), so the page opens on the tree.
  await setCanaryCustomer(owner.id, defined(CUSTOMER_CANARIES[0]).id);
  await insertKindedRows(owner.id);
  await page.goto(`/estimates/${canaryTaskCodeFor(owner.id)}`);
  const viewsTree = isPhone(page) ? 'button[data-early-intent="parts-tree"]' : 'nav[aria-label="Parts tree"] a[data-part-id]';
  await waitUntilHydrated(page, viewsTree, 'onClick');
  await showTree(page);

  // KIND-1: each kind has its own glyph and its spoken name; two Parts under one parent are both a Sub-part.
  const glyph = (slNo: string, kind: string, name: string): Locator => row(page, slNo).locator(`svg[data-node-kind="${kind}"][aria-label="${name}"]`);
  await expect(glyph('1', 'MAIN_ASSEMBLY', 'Main Assembly')).toBeVisible();
  await expect(glyph('1.1', 'SUB_ASSEMBLY', 'Sub-Assembly')).toBeVisible();
  await expect(glyph('1.2', 'PART', 'Sub-part')).toBeVisible();
  await expect(glyph('1.3', 'PART', 'Sub-part')).toBeVisible();
  await expect(glyph('1.3.1', 'FASTENER', 'Fastener')).toBeVisible();

  // NAME-3: with no Description and no Part No. a row shows its kind's own name, muted and italic, and says in words that it has no description yet.
  await expect(nameOf(page, '1')).toHaveText('Main Assembly, no description yet');
  await expect(nameOf(page, '1.1')).toHaveText('Sub-Assembly, no description yet');
  await expect(nameOf(page, '1.3.1')).toHaveText('Fastener, no description yet');
  await expect(nameOf(page, '1.1').locator('span').first()).toHaveCSS('font-style', 'italic');
  // NAME-2 and NAME-1: the Part No. names a row with no Description, and the Description wins over the Part No.; a named row is plain text, never "Part".
  await expect(nameOf(page, '1.2')).toHaveText('XP-1101');
  await expect(nameOf(page, '1.3')).toHaveText('Base frame');
  await expect(nameOf(page, '1.3').locator('span')).toHaveCount(0);

  // Adding a row: the status says what was added and how to name it, and the focus is on the new row's link.
  await row(page, '1.1').click();
  await revealRowToolbar(row(page, '1.1'));
  await rowButton(page, 'Add under', '1.1').click();
  await page.getByRole('menuitem', { name: 'Part', exact: true }).click();
  await expect(page.getByText('Added 1.1.1 Part. Type a Description to name it.')).toHaveCount(1);
  await expect(row(page, '1.1.1')).toBeFocused();
  await expect(nameOf(page, '1.1.1')).toHaveText('Part, no description yet');

  // Enter on the link moves into the form (on a phone the drawer closes first). Description tells what it does.
  await page.keyboard.press('Enter');
  await expect(control(page, 'D')).toBeEnabled();
  await expect(page.getByText('Names this row in the parts tree.')).toBeVisible();

  // NAME-4: typing changes nothing in the tree; leaving the field does, and the server holds the name.
  const saved = nextSave(page, 'D');
  await control(page, 'D').fill('Cover plate');
  await control(page, 'D').blur();
  expect(await saved).toBe(200);
  await showTree(page);
  await expect(nameOf(page, '1.1.1')).toHaveText('Cover plate');
  const answer = await page.request.get(`/api/v1/estimates/${owner.id}/tree`);
  expect(answer.status()).toBe(200);
  const nodes = ((await answer.json()) as { nodes: Array<{ slNo: string; label: string }> }).nodes;
  expect(nodes.map((node) => [node.slNo, node.label])).toEqual([
    ['1', ''],
    ['1.1', ''],
    ['1.1.1', 'Cover plate'],
    ['1.2', 'XP-1101'],
    ['1.3', 'Base frame'],
    ['1.3.1', ''],
  ]);
});
