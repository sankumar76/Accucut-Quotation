/**
 * The kinds of a parts-tree row and which kind may sit under which (CR-01 item 3A, AQP-403; SPEC section 6.1; architecture section 4.12 e; ADR-020 K1). Pure code: the server
 * reads `ALLOWED_CHILDREN` to refuse an add, and the browser reads the same table to offer the "+" menu (story 3C), so the menu offers exactly what the server accepts.
 *
 * **Four kinds are stored** (`estimate_nodes.node_kind`): Main Assembly, Sub-Assembly, Part and Fastener. **"Sub-part" is not stored**: it is how a PART is named when
 * its parent holds two or more PARTs (`nodeKindLabel`), so an add or a delete renames the siblings at once and no kind can go stale. The kind never changes after the row is added.
 * The calculation does not read it.
 */

export const NODE_KINDS = ['MAIN_ASSEMBLY', 'SUB_ASSEMBLY', 'PART', 'FASTENER'] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

/** The parent an add is made under: a kind, or `TOP` for the top level of the tree (an add with no parent). */
export type ParentKind = NodeKind | 'TOP';

/**
 * Which kinds a new row may have under each kind of parent (SPEC 6.1, tests 14.30). One table, one source. Only **new** adds are checked against it: a legacy tree that is deeper
 * than this allows stays as it is (AC-6), and a move within one parent never changes a tree's shape.
 */
export const ALLOWED_CHILDREN: Readonly<Record<ParentKind, ReadonlyArray<NodeKind>>> = Object.freeze({
  TOP: Object.freeze<NodeKind[]>(['MAIN_ASSEMBLY']),
  MAIN_ASSEMBLY: Object.freeze<NodeKind[]>(['SUB_ASSEMBLY', 'PART', 'FASTENER']),
  SUB_ASSEMBLY: Object.freeze<NodeKind[]>(['PART', 'FASTENER']),
  PART: Object.freeze<NodeKind[]>(['FASTENER']),
  FASTENER: Object.freeze<NodeKind[]>([]),
});

/** The name of each stored kind, as it is shown (the PART's name depends on its siblings: `nodeKindLabel`). */
export const NODE_KIND_NAMES: Readonly<Record<NodeKind, string>> = Object.freeze({
  MAIN_ASSEMBLY: 'Main Assembly',
  SUB_ASSEMBLY: 'Sub-Assembly',
  PART: 'Part',
  FASTENER: 'Fastener',
});

/** May a row of `child` kind be added under a parent of this kind (`null`: the top level)? */
export function isAllowedChild(parent: NodeKind | null, child: NodeKind): boolean {
  return ALLOWED_CHILDREN[parent ?? 'TOP'].includes(child);
}

/** The first kind the table allows under this parent, or null when it allows none (a Fastener). The interim "Add sub-part" button of the existing screen uses it until the "+" menu (3C). */
export function firstAllowedChild(parent: NodeKind): NodeKind | null {
  return ALLOWED_CHILDREN[parent][0] ?? null;
}

/** What `nodeKindLabel` needs of a row: its place and its stored kind. */
export interface KindedNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly nodeKind: NodeKind;
}

/**
 * The name of a row's kind (AC-4, 14.31): "Part" when it is the only PART under its parent, "Sub-part" when there are two or more, the kind's own name for every other kind.
 * Derived on read and never stored. `siblings` are the rows to look at; only those under the same parent count, and the row itself counts once whether or not it is in the list.
 */
export function nodeKindLabel(node: KindedNode, siblings: ReadonlyArray<KindedNode>): string {
  if (node.nodeKind !== 'PART') return NODE_KIND_NAMES[node.nodeKind];
  const otherParts = siblings.some((sibling) => sibling.id !== node.id && sibling.parentId === node.parentId && sibling.nodeKind === 'PART');
  return otherParts ? 'Sub-part' : NODE_KIND_NAMES.PART;
}
