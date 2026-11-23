'use client';

import { ArrowDown, ArrowUp, CornerDownRight, Plus, Trash2, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { PartsTreeList } from '@/components/shared/parts-tree-list';
import { TreeLegend } from '@/components/shared/tree-legend';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { stepOf } from '@/lib/estimates/tree-moves';

import type { DeletePartDialogProps } from './delete-part-dialog';
import {
  FAILED_BODY,
  TREE_CHANGED_NOTICE,
  TREE_DELETE,
  TREE_EMPTY,
  TREE_FAILED_TITLE,
  TREE_LOAD_FAILED_TITLE,
  TREE_LOADING,
  TREE_MOVE_DOWN,
  TREE_MOVE_UP,
  TREE_NEW_ITEM,
  TREE_PART_BESIDE,
  TREE_SUB_PART,
  TREE_TITLE,
  TRY_AGAIN,
} from './estimate-texts';
import { TreeNode } from './tree-node';
import { useLazyComponent } from './use-lazy-component';
import type { PartsTreeState } from './use-parts-tree';

export interface TreePanelProps {
  readonly tree: PartsTreeState;
  /** True while the estimate is a draft. Otherwise the part actions are not shown at all (UX-07): the server would refuse them. */
  readonly editable: boolean;
  /** Enter on a row's link opens its form (STORY-05.03, review SQR-11): the form takes the focus. A press with a mouse or a finger only chooses the row. */
  readonly onOpen?: (id: string) => void;
  /** The parts Calculate found a missing input in (STORY-05.09): each shows a triangle. Client state from the blocked answer. */
  readonly missingIds?: ReadonlySet<string>;
}

const TREE_ID = 'parts-tree';

/** The delete dialog's code, fetched after the page is up (`use-lazy-component.ts`; NFR-009: the first load of this page has no room left in 200 KB). */
const loadDeleteDialog = () => import('./delete-part-dialog').then((module) => module.DeletePartDialog);

/** Where focus goes when the delete dialog closes: the link of the open row. The deleted part has no element to return to. */
function focusTree(event: Event): void {
  event.preventDefault();
  document.querySelector<HTMLElement>(`#${TREE_ID} a[aria-current="true"]`)?.focus();
}

/**
 * One action of the toolbar: an icon and its words, so it is never an icon alone. An action that cannot be taken is `aria-disabled`, not `disabled`: a button that is
 * pressed and then disabled (Move up on the way to the top) would drop the keyboard focus to the page, and the person would have to find their place again.
 */
function ToolbarButton({ icon, label, unavailable, onClick }: { readonly icon: LucideIcon; readonly label: string; readonly unavailable: boolean; readonly onClick: () => void }) {
  return (
    <Button variant="secondary" aria-disabled={unavailable || undefined} className={cn(unavailable && 'cursor-not-allowed opacity-60')} onClick={unavailable ? undefined : onClick}>
      <Icon icon={icon} />
      {label}
    </Button>
  );
}

/**
 * The parts tree and its actions (STORY-05.02 AC-1 to AC-3, as changed by CR-01 item 3B): the tree is a `nav` with nested lists of row links, each row with an arrow that opens and closes its branch, a kind icon,
 * the number and name and the status icon (`PartsTreeList`, `TreeNode`), and a legend of the four icons at its foot. Above it the toolbar of New item, Sub-part, Part beside, Move up, Move down and Delete stays
 * until the row actions of 3C and 3D replace it, and a live region says what changed ("Part renumbered to 1.2"). There is no arrow-key navigation: Tab moves from row to row and to each arrow, and Enter on
 * a row opens its form (PM ruling). All of it is the screen's: every rule is the server's, and what the tree shows is what the server last answered.
 */
export function TreePanel({ tree, editable, onOpen, missingIds }: TreePanelProps) {
  const { nodes, selected, busy } = tree;
  const deleteDialog = useLazyComponent<DeletePartDialogProps>(loadDeleteDialog, tree.deleting !== null);
  const DeleteDialog = deleteDialog.Component;
  // The branches that are closed. The tree opens with every branch open; what a person closes stays closed while the panel is on screen (the state is this panel's, not the server's).
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string): void => setClosed((current) => (current.has(id) ? new Set([...current].filter((other) => other !== id)) : new Set([...current, id])));
  const canUp = selected !== null && nodes !== null && stepOf(nodes, selected, 'up') !== null;
  const canDown = selected !== null && nodes !== null && stepOf(nodes, selected, 'down') !== null;

  let body: ReactNode;
  if (nodes === null && tree.loadFailed) {
    body = (
      <Notice tone="danger" title={TREE_LOAD_FAILED_TITLE}>
        <p>{FAILED_BODY}</p>
        <Button variant="secondary" className="mt-s-2" onClick={tree.readAgain}>
          {TRY_AGAIN}
        </Button>
      </Notice>
    );
  } else if (nodes === null) {
    body = (
      <div role="status" aria-label={TREE_LOADING} className="flex flex-col gap-s-2">
        <Skeleton className="h-(--control-h)" />
        <Skeleton className="h-(--control-h)" />
        <Skeleton className="h-(--control-h)" />
      </div>
    );
  } else if (nodes.length === 0) {
    body = <p className="text-body text-ink-2">{TREE_EMPTY}</p>;
  } else {
    const choose = (id: string, byKeyboard: boolean): void => (byKeyboard && onOpen !== undefined ? onOpen(id) : tree.select(id));
    body = (
      <>
        <PartsTreeList
          id={TREE_ID}
          label={TREE_TITLE}
          nodes={nodes}
          closed={closed}
          onToggle={toggle}
          renderRow={(part, kindLabel) => <TreeNode part={part} kindLabel={kindLabel} selected={part.id === selected?.id} missing={missingIds?.has(part.id) ?? false} onChoose={choose} />}
        />
        <TreeLegend />
      </>
    );
  }

  const noPart = selected === null;
  return (
    <div className="flex min-w-0 flex-col gap-s-3">
      {editable ? (
        <div className="flex flex-wrap gap-s-2">
          <ToolbarButton icon={Plus} label={TREE_NEW_ITEM} unavailable={nodes === null} onClick={() => tree.add('item')} />
          <ToolbarButton icon={CornerDownRight} label={TREE_SUB_PART} unavailable={noPart} onClick={() => tree.add('sub-part')} />
          <ToolbarButton icon={Plus} label={TREE_PART_BESIDE} unavailable={noPart} onClick={() => tree.add('beside')} />
          <ToolbarButton icon={ArrowUp} label={TREE_MOVE_UP} unavailable={noPart || !canUp} onClick={() => tree.move('up')} />
          <ToolbarButton icon={ArrowDown} label={TREE_MOVE_DOWN} unavailable={noPart || !canDown} onClick={() => tree.move('down')} />
          <ToolbarButton icon={Trash2} label={TREE_DELETE} unavailable={noPart} onClick={tree.askDelete} />
        </div>
      ) : null}
      {tree.problem === null ? null : (
        <Notice tone="danger" title={tree.problem.kind === 'changed' ? TREE_CHANGED_NOTICE : tree.problem.kind === 'refused' ? tree.problem.message : TREE_FAILED_TITLE}>
          {tree.problem.kind === 'failed' ? FAILED_BODY : null}
        </Notice>
      )}
      {body}
      <p role="status" className="sr-only">
        {tree.announcement}
      </p>
      {DeleteDialog === null ? null : (
        <DeleteDialog target={tree.deleting} open={tree.deleteOpen} deleting={busy} onConfirm={() => void tree.confirmDelete()} onCancel={tree.cancelDelete} onCloseAutoFocus={focusTree} />
      )}
    </div>
  );
}
