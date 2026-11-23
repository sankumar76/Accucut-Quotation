'use client';

import { Minus } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { NodeKind } from '@/lib/estimate/node-kinds';
import type { PartItem } from '@/lib/estimates/tree-client';
import { actionsLabel, addActionOf, addFastenerLabel, addUnderLabel, deleteRowLabel, moveRowLabel } from '@/lib/estimates/tree-actions';

import { AddNodeMenu } from './add-node-menu';
import { AddNodeTrigger, ROW_ACTION_SIZE, UNAVAILABLE_LOOK } from './add-node-trigger';
import { TREE_PART_NAME } from './estimate-texts';
import { MoveHandle } from './move-handle';

export interface RowActionsProps {
  readonly part: PartItem;
  /** Adds a row of this kind last under the row `parentId`. */
  readonly onAdd: (parentId: string, nodeKind: NodeKind) => void;
  /** Opens the confirmation of the delete of this row (nothing is sent yet). */
  readonly onDelete: (id: string) => void;
  /** The place Move up takes this row to among its siblings, or null on the first (`stepOf`), and the place Move down takes it to, or null on the last (CR-01 item 3D). */
  readonly upTo: number | null;
  readonly downTo: number | null;
  /** Moves the row `id` to this place among the rows with the same parent: from a drop of the handle and from its menu. */
  readonly onMoveTo: (id: string, index: number) => void;
  /** A change to the tree is on its way (AQP-343): the "+" and the "-" are `aria-disabled` and keep the focus, and a press does nothing. Absent when not. */
  readonly busy?: boolean;
  /** The ID of the line that says why they are not offered, when it is on screen (`aria-describedby`). */
  readonly describedBy?: string | undefined;
  /** The delete confirmation of this row is open (AQP-418): the toolbar stays in view until the dialog is gone, although the focus is in the dialog. Never `busy`: a change on its way does not show or hide the toolbar. */
  readonly showing?: boolean;
}

/**
 * When the toolbar is in view (AQP-418, DEF-075; UX design of AQP-406 comment 12939). It is `sr-only`: clipped to 1 px with no hit area, and still in the tab order and in the accessibility tree (never `opacity-0`,
 * `hidden`, `invisible` or `display: none`, which either take presses or take the buttons away). It is in view (`not-sr-only`) on the open row (`aria-current`), while focus is visible anywhere in the row
 * (Tab onto the link shows it before Tab reaches a button), and while a menu of the row is open (the move handle's or the "+": `aria-haspopup`, so the arrows, which also carry `aria-expanded`, do not count).
 * There is no hover look and no touch variant: hover only tints the row. The classes read `group/row`, the row of `PartsTreeList`.
 */
const HIDDEN_UNTIL_NEEDED = 'sr-only group-has-[[aria-current=true]]/row:not-sr-only group-has-[:focus-visible]/row:not-sr-only group-has-[[aria-haspopup][aria-expanded=true]]/row:not-sr-only';

/**
 * The toolbar of one row of the parts tree (CR-01 item 3C, UX spec section 0.9 row 3): the **move handle** (3D: a drag among the rows with the same parent, or a click for Move up / Move down), the **"+"** and the **"-"**, in a group named after the
 * row, on a line of its own under the row's name (AQP-418, DEF-075: it never floats over a row, so a press on a name is always a press on the row). It is in view on the open row, on keyboard focus within the row and while one of its menus or its delete
 * confirmation is open, and clipped otherwise (`HIDDEN_UNTIL_NEEDED`). The "+" offers exactly the kinds that `ALLOWED_CHILDREN`
 * allows under this row (`addActionOf`): a menu for a Main Assembly or a Sub-Assembly (its code loads on the first open, `AddNodeMenu`), the Fastener at once for a Part or a Sub-part, and no "+" at all on a Fastener.
 * The "-" opens the existing confirmation, which names the row and every row under it. Each button's name is its tooltip and its spoken name, and says which row it is for. Tab moves from a row to these buttons.
 * It is drawn only where the person may change the inputs (`treeActionsOffered`); the server asks again.
 */
export function RowActions({ part, onAdd, onDelete, upTo, downTo, onMoveTo, busy = false, describedBy, showing = false }: RowActionsProps) {
  const add = addActionOf(part.nodeKind);
  const name = part.label === '' ? TREE_PART_NAME : part.label;
  const remove = deleteRowLabel(part.slNo, name);
  const why = busy && describedBy !== undefined ? { 'aria-describedby': describedBy } : {};
  return (
    <div data-row-actions="" role="group" aria-label={actionsLabel(part.slNo, name)} className={showing ? 'not-sr-only' : HIDDEN_UNTIL_NEEDED}>
      <div className="mt-s-1 ml-s-1 flex w-fit items-center rounded-md border border-border bg-surface">
        <MoveHandle id={`move-${part.id}`} label={moveRowLabel(part.slNo, name)} upTo={upTo} downTo={downTo} onMoveTo={(index) => onMoveTo(part.id, index)} {...(busy ? { unavailable: true, ...(describedBy === undefined ? {} : { describedBy }) } : {})} />
        {add.kind === 'direct' ? <AddNodeTrigger label={addFastenerLabel(part.slNo, name)} unavailable={busy} {...why} onClick={busy ? undefined : () => onAdd(part.id, add.nodeKind)} /> : null}
        {add.kind === 'menu' ? <AddNodeMenu id={`add-node-${part.id}`} label={addUnderLabel(part.slNo, name)} nodeKinds={add.nodeKinds} onChoose={(nodeKind) => onAdd(part.id, nodeKind)} {...(busy ? { unavailable: true, ...(describedBy === undefined ? {} : { describedBy }) } : {})} /> : null}
        <Button
          variant="ghost"
          size="icon"
          aria-label={remove}
          title={remove}
          className={cn('text-danger-ink', ROW_ACTION_SIZE, busy && UNAVAILABLE_LOOK)}
          {...(busy ? { 'aria-disabled': true } : {})}
          {...why}
          onClick={busy ? undefined : () => onDelete(part.id)}
        >
          <Icon icon={Minus} size="large" />
        </Button>
      </div>
    </div>
  );
}
