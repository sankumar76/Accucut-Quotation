import type { PartFormSeed } from './part-form-seed';
import { parseTreeAnswer, type PartItem } from './tree-client';

/**
 * The plain rules of the review's editing island (DEF-131 stage 2T; UX ruling `lead-admin-edit-inputs-2026-11-27.md` 4.7): which figures a row of the tree the island holds has, the address of the chosen row and what to
 * say when the open row was removed by someone else. No component and no request, so each rule is a table in a unit test, and no figure is read here: a figure is only ever carried from the page's rows to the same row.
 */

/**
 * The rows of the tree the island holds (the server's tree, read by `usePartsTree`), each with what the page knows of it, joined **by the row's ID** and never by its place or its number: a row added a moment ago has
 * no row on the page yet (`null`: a dash and no count), and a row that was moved or renumbered keeps its own. A row the page holds but the tree does not (deleted a moment ago) is not in the answer. The tree is the one
 * source of which rows there are, in what order and under which name (a rename shows at once); the page is the source of the figures.
 */
export function joinRows<R extends { readonly id: string }>(items: ReadonlyArray<PartItem>, page: ReadonlyArray<R>): ReadonlyMap<string, R | null> {
  const byId = new Map(page.map((row) => [row.id, row] as const));
  return new Map(items.map((item) => [item.id, byId.get(item.id) ?? null] as const));
}

/**
 * The address of the page with the chosen row in it (`?row=<Sl. No>`, 4.7 (c)): the other parts of the address stay, so a reload and a shared link open the same row. The island writes this with
 * `history.replaceState` and no navigation.
 */
export function addressWithRow(href: string, slNo: string): string {
  const url = new URL(href);
  url.searchParams.set('row', slNo);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** What the open row was when the person last looked at it: enough to say it is gone. */
export interface OpenRow {
  readonly id: string;
  readonly slNo: string;
}

/**
 * Whether the row that was open is gone and nobody here removed it (ED-27): the tree has been read again and the open row is not in it, and it is not one of the rows this person's own delete took. Then the block falls
 * back to the row the tree now offers, and the island says so once. A row that is only renumbered is still there (it is found by its ID), so a move or a delete of another row never says it.
 */
export function removedElsewhere(open: OpenRow | null, tree: ReadonlyArray<PartItem>, ownRemovedIds: ReadonlyArray<string>): boolean {
  if (open === null || tree.length === 0) return false;
  return !tree.some((item) => item.id === open.id) && !ownRemovedIds.includes(open.id);
}

/**
 * The seed the island's form may start from (ARC-811-01): the page's seed, **only when its tree is one the browser accepts** for this estimate, which is the tree the island then holds (`usePartsTree`). A form that started
 * from the seed's values while the tree was read from the server later would send saves with the tree's newer revision under the seed's older values, so with no tree from the seed the form reads its own part.
 */
export function formSeedOf(seed: PartFormSeed | undefined, estimateId: string): PartFormSeed | undefined {
  return seed !== undefined && seed.estimateId === estimateId && parseTreeAnswer(seed.tree) !== null ? seed : undefined;
}
