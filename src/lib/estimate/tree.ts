/**
 * The parts tree as pure code (STORY-05.02; FR-043, FR-044; architecture sections 4.8 and 5.1 `estimate_nodes`; SPEC section 14.3). A node is an ID, the ID of
 * its parent (null at the top) and a `sortIndex` among its siblings. **The Sl. No is never stored**: it is the path of 1-based positions of a node among its
 * siblings ("1", "1.1", "1.1.2"), read from the layout every time, so it cannot drift after an add, a move or a delete. Depth is unlimited, so nothing here recurses.
 *
 * The three changes (`insertNode`, `moveNode`, `removeNodes`) each take a layout and return the whole new layout, with every sibling group renumbered 0, 1, 2, ...
 * (a gap in `sortIndex` is healed, not kept). `changedPlacements` then names the rows that really differ, so the repository writes only those and a change that
 * moves nothing writes nothing. This file knows no database, no role and no cost.
 */

/** Where a node sits: the one fact about a node the tree rules read. */
export interface PlacedNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly sortIndex: number;
}

/** A node in reading order: the node, its Sl. No and its level (1 at the top). */
export interface TreeEntry<N extends PlacedNode> {
  readonly node: N;
  readonly slNo: string;
  readonly level: number;
}

/** Siblings by parent, each group in order: by `sortIndex`, and by ID when two share one, so the order is the same whatever order the rows were read in. */
function childrenByParent<N extends PlacedNode>(nodes: ReadonlyArray<N>): Map<string | null, N[]> {
  const groups = new Map<string | null, N[]>();
  for (const node of nodes) {
    const group = groups.get(node.parentId);
    if (group === undefined) groups.set(node.parentId, [node]);
    else group.push(node);
  }
  for (const group of groups.values()) group.sort((a, b) => a.sortIndex - b.sortIndex || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return groups;
}

/**
 * The nodes in reading order (depth first, siblings in order) with the Sl. No and level of each. A node that cannot be reached from the top (its parent is not in
 * the list) is left out, and a node reached twice is listed once, so a broken link is never shown as a part and can never loop.
 */
export function buildTree<N extends PlacedNode>(nodes: ReadonlyArray<N>): TreeEntry<N>[] {
  const groups = childrenByParent(nodes);
  const entries: TreeEntry<N>[] = [];
  const seen = new Set<string>();
  const pending: Array<{ readonly parentId: string | null; readonly prefix: string; readonly level: number; next: number }> = [{ parentId: null, prefix: '', level: 1, next: 0 }];
  for (let top = pending[pending.length - 1]; top !== undefined; top = pending[pending.length - 1]) {
    const child = groups.get(top.parentId)?.[top.next];
    if (child === undefined) {
      pending.pop();
      continue;
    }
    top.next += 1;
    if (seen.has(child.id)) continue;
    seen.add(child.id);
    const slNo = top.prefix === '' ? String(top.next) : `${top.prefix}.${top.next}`;
    entries.push({ node: child, slNo, level: top.level });
    pending.push({ parentId: child.id, prefix: slNo, level: top.level + 1, next: 0 });
  }
  return entries;
}

/** The Sl. No of every node that can be reached, by ID. */
export function slNumbers(nodes: ReadonlyArray<PlacedNode>): Map<string, string> {
  return new Map(buildTree(nodes).map((entry) => [entry.node.id, entry.slNo]));
}

/** The place of this node among its siblings (0 is first), or -1 when it is not in the list. */
export function siblingIndex(nodes: ReadonlyArray<PlacedNode>, id: string): number {
  const node = nodes.find((candidate) => candidate.id === id);
  return node === undefined ? -1 : (childrenByParent(nodes).get(node.parentId) ?? []).findIndex((sibling) => sibling.id === id);
}

/** How many nodes sit directly under this parent (null: the top level). */
export function childCount(nodes: ReadonlyArray<PlacedNode>, parentId: string | null): number {
  return nodes.filter((node) => node.parentId === parentId).length;
}

/** Every node below this one, to any depth, and not the node itself. An unknown ID has none. */
export function descendantIds(nodes: ReadonlyArray<PlacedNode>, id: string): string[] {
  const groups = childrenByParent(nodes);
  const found: string[] = [];
  const seen = new Set<string>([id]);
  const queue = [id];
  for (let current = queue.shift(); current !== undefined; current = queue.shift()) {
    for (const child of groups.get(current) ?? []) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      found.push(child.id);
      queue.push(child.id);
    }
  }
  return found;
}

/** May this node go under this parent (null is the top level)? Not under itself or one of its own descendants (that would cut it off from the tree), and both must exist. */
export function canMove(nodes: ReadonlyArray<PlacedNode>, id: string, parentId: string | null): boolean {
  if (!nodes.some((node) => node.id === id)) return false;
  if (parentId === null) return true;
  return parentId !== id && nodes.some((node) => node.id === parentId) && !descendantIds(nodes, id).includes(parentId);
}

/** The groups of IDs in order, ready to be edited and written back as a layout. */
function groupsOf(nodes: ReadonlyArray<PlacedNode>): Map<string | null, string[]> {
  return new Map([...childrenByParent(nodes)].map(([parentId, group]) => [parentId, group.map((node) => node.id)]));
}

/** A layout from groups of IDs: every group numbered 0, 1, 2, ... in its order. */
function layoutOf(groups: ReadonlyMap<string | null, ReadonlyArray<string>>): PlacedNode[] {
  return [...groups].flatMap(([parentId, ids]) => ids.map((id, sortIndex) => ({ id, parentId, sortIndex })));
}

const clamp = (index: number, length: number): number => Math.min(Math.max(index, 0), length);

function withoutIds(groups: Map<string | null, string[]>, ids: ReadonlySet<string>): void {
  for (const [parentId, group] of groups) groups.set(parentId, group.filter((id) => !ids.has(id)));
}

/** The layout with one more node at `index` among the children of `parentId` (null: the top), the siblings after it moving along. An index out of range is put at the nearest end. */
export function insertNode(nodes: ReadonlyArray<PlacedNode>, added: { readonly id: string; readonly parentId: string | null; readonly index: number }): PlacedNode[] {
  const groups = groupsOf(nodes);
  const siblings = [...(groups.get(added.parentId) ?? [])];
  siblings.splice(clamp(added.index, siblings.length), 0, added.id);
  groups.set(added.parentId, siblings);
  return layoutOf(groups);
}

/**
 * The layout with this node, and everything under it, under `parentId` (null: the top) and at `index` among its new siblings: `index` is the place the node
 * ends up in (0 is first), counted without the node itself, so moving a node down one place within its parent is `index` + 1. An index out of range is put at the
 * nearest end. The caller has checked `canMove`.
 */
export function moveNode(nodes: ReadonlyArray<PlacedNode>, id: string, parentId: string | null, index: number): PlacedNode[] {
  const groups = groupsOf(nodes);
  withoutIds(groups, new Set([id]));
  const siblings = [...(groups.get(parentId) ?? [])];
  siblings.splice(clamp(index, siblings.length), 0, id);
  groups.set(parentId, siblings);
  return layoutOf(groups);
}

/** The layout without these nodes, the gaps they leave closed. The caller names a node together with all its descendants (`descendantIds`). */
export function removeNodes(nodes: ReadonlyArray<PlacedNode>, ids: ReadonlyArray<string>): PlacedNode[] {
  const groups = groupsOf(nodes);
  const gone = new Set(ids);
  withoutIds(groups, gone);
  for (const id of gone) groups.delete(id);
  return layoutOf(groups);
}

/** The nodes of `after` whose parent or place differs from `before`, or that `before` did not have: the rows to write. */
export function changedPlacements(before: ReadonlyArray<PlacedNode>, after: ReadonlyArray<PlacedNode>): PlacedNode[] {
  const was = new Map(before.map((node) => [node.id, node]));
  return after.filter((node) => {
    const old = was.get(node.id);
    return old === undefined || old.parentId !== node.parentId || old.sortIndex !== node.sortIndex;
  });
}
