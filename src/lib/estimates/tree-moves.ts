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

/** How many parts a delete of this part removes: the part and every sub-part at any depth. */
export function partsRemoved(nodes: ReadonlyArray<PartItem>, id: string): number {
  const gone = new Set([id]);
  // Reading order lists a parent before its children, so one pass finds the whole branch.
  for (const node of nodes) if (node.parentId !== null && gone.has(node.parentId)) gone.add(node.id);
  return gone.size;
}

/** A part with what a tree needs to say about where it is: its level (1 at the top), its place among its siblings (1 is first) and how many siblings it has. */
export interface PartRow {
  readonly part: PartItem;
  readonly level: number;
  readonly position: number;
  readonly size: number;
}

/** Every part in reading order with its level and place, for `aria-level`, `aria-posinset` and `aria-setsize`. A part whose parent is not in the list is at level 1. */
export function rowsOf(nodes: ReadonlyArray<PartItem>): PartRow[] {
  const levels = new Map<string, number>();
  const counts = new Map<string | null, number>();
  for (const node of nodes) counts.set(node.parentId, (counts.get(node.parentId) ?? 0) + 1);
  const seen = new Map<string | null, number>();
  return nodes.map((part) => {
    const position = (seen.get(part.parentId) ?? 0) + 1;
    seen.set(part.parentId, position);
    const level = part.parentId === null ? 1 : (levels.get(part.parentId) ?? 0) + 1;
    levels.set(part.id, level);
    return { part, level, position, size: counts.get(part.parentId) ?? 1 };
  });
}
