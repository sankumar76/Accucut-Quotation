import { firstAllowedChild } from '../estimate/node-kinds';

import type { AddRequest, PartItem } from './tree-client';

/**
 * The three Add buttons of the parts-tree screen as they are until the "+" menu of CR-01 3C replaces them (AQP-403 AC-8). Nothing here decides whether an add is allowed: the server
 * checks the kind against its parent's (`ALLOWED_CHILDREN`) and this only picks what to ask for, from the same table, so the screen keeps working with the new body.
 */
export type AddButton = 'item' | 'sub-part' | 'beside';

/**
 * What a button asks the server to add: "Add item" is a Main Assembly at the top, "Add sub-part" is the first kind the selected row's kind allows, last under it, and "beside" is a row of
 * the selected row's own kind, last under the selected row's parent (the server puts every new row last, so "beside" no longer means "right after"). Null when there is nothing to ask
 * for: no row is selected, or a Fastener, which holds nothing, was asked for a sub-part.
 */
export function addRequestOf(button: AddButton, selected: PartItem | null): AddRequest | null {
  if (button === 'item') return { parentId: null, nodeKind: 'MAIN_ASSEMBLY' };
  if (selected === null) return null;
  if (button === 'beside') return { parentId: selected.parentId, nodeKind: selected.nodeKind };
  const nodeKind = firstAllowedChild(selected.nodeKind);
  return nodeKind === null ? null : { parentId: selected.id, nodeKind };
}
