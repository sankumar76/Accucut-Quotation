import { subtreeFingerprint } from '../estimate/subtree-fingerprint';

import type { PartItem } from './tree-client';

/**
 * What the parts-tree screen works out from the tree it was last given, to ask the server for a change (STORY-05.02 AC-2, AC-3). The server decides every one of these
 * again, so a tree that is out of date gets a 409 and the fresh tree, never a wrong change. The nodes are in reading order (parents before their children).
 */

/** The parts directly under this parent (null: the top), in order. */
export function siblingsOf(nodes: ReadonlyArray<PartItem>, parentId: string | null): PartItem[] {
  return nodes.filter((node) => node.parentId === parentId);
}

/** The place a part ends up in to go one place up or down among its siblings, or null at the end it cannot go further. */
export function stepOf(nodes: ReadonlyArray<PartItem>, part: PartItem, direction: 'up' | 'down'): number | null {
  const siblings = siblingsOf(nodes, part.parentId);
  const target = siblings.findIndex((sibling) => sibling.id === part.id) + (direction === 'up' ? -1 : 1);
  return target < 0 || target >= siblings.length ? null : target;
}

/** The parts a delete of this part removes: the part and every sub-part at any depth. */
export function partsRemoved(nodes: ReadonlyArray<PartItem>, id: string): PartItem[] {
  const gone = new Set([id]);
  // Reading order lists a parent before its children, so one pass finds the whole branch.
  for (const node of nodes) if (node.parentId !== null && gone.has(node.parentId)) gone.add(node.id);
  return nodes.filter((node) => gone.has(node.id));
}

/** The count and the fingerprint of the parts a delete of this part removes, as the dialog names them and the server checks them. */
export function deleteGuardOf(nodes: ReadonlyArray<PartItem>, id: string): { readonly parts: number; readonly subtree: string } {
  const removed = partsRemoved(nodes, id);
  return { parts: removed.length, subtree: subtreeFingerprint(removed) };
}

/** A node and the nodes directly under it, in order: the nesting of the tree (CR-01 item 3B). The level, the place among the siblings and their number are not stored: nesting tells them, and no aria count does. */
export interface Branch<T> {
  readonly node: T;
  readonly children: ReadonlyArray<Branch<T>>;
}

/**
 * The tree as nesting, from nodes in reading order (parents before their children, siblings in order). A node whose parent is not in the list is at the top, so a broken link is shown, not lost.
 * Built in one pass with no recursion, so a legacy tree of any depth cannot overflow the stack (the rendering recurses, the building does not).
 */
export function branchesOf<T extends { readonly id: string; readonly parentId: string | null }>(nodes: ReadonlyArray<T>): Branch<T>[] {
  const made = new Map<string, { readonly node: T; readonly children: Branch<T>[] }>(nodes.map((node) => [node.id, { node, children: [] }]));
  const top: Branch<T>[] = [];
  for (const node of nodes) {
    const branch = made.get(node.id);
    if (branch === undefined) continue;
    const parent = node.parentId === null ? undefined : made.get(node.parentId);
    (parent === undefined ? top : parent.children).push(branch);
  }
  return top;
}
