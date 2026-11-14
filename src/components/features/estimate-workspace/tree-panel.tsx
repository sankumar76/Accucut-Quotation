'use client';

import { ArrowDown, ArrowUp, CornerDownRight, Plus, Trash2, type LucideIcon } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';

import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { rowsOf, stepOf } from '@/lib/estimates/tree-moves';

import { DeletePartDialog } from './delete-part-dialog';
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
import type { PartsTreeState } from './use-parts-tree';

export interface TreePanelProps {
  readonly tree: PartsTreeState;
  /** True while the estimate is a draft. Otherwise the part actions are not shown at all (UX-07): the server would refuse them. */
  readonly editable: boolean;
  /** Enter on a part opens its form (STORY-05.03). Until that story passes it, Enter does nothing more than the selection that focus already made. */
  readonly onOpen?: (id: string) => void;
}

const TREE_ID = 'parts-tree';

/** Where focus goes when the delete dialog closes: the tab stop of the tree. The deleted part has no element to return to. */
function focusTree(event: Event): void {
  event.preventDefault();
  document.querySelector<HTMLElement>(`#${TREE_ID} [role="treeitem"][tabindex="0"]`)?.focus();
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
 * The parts tree and its actions (STORY-05.02 AC-1 to AC-3, AC-9; UX spec SCR-05 "Tree"): a `tree` of `treeitem`s, a toolbar of New item, Sub-part, Part beside, Move up,
 * Move down and Delete, and a live region that says what changed ("Part renumbered to 1.2"). Arrow keys move between parts (selection follows focus), Home and End go to the
 * first and last, Right goes to the first sub-part and Left to the parent, Alt with Up or Down moves the part (no dragging is needed), and Enter opens the part once its
 * form exists. All of it is the screen's: every rule is the server's, and what the tree shows is what the server last answered.
 */
export function TreePanel({ tree, editable, onOpen }: TreePanelProps) {
  const { nodes, selected, busy } = tree;
  const rows = nodes === null ? [] : rowsOf(nodes);
  const canUp = selected !== null && nodes !== null && stepOf(nodes, selected, 'up') !== null;
  const canDown = selected !== null && nodes !== null && stepOf(nodes, selected, 'down') !== null;

  function onKeyDown(event: KeyboardEvent<HTMLUListElement>): void {
    const item = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[role="treeitem"]') : null;
    if (item === null || event.target !== item) return;
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      if (editable) tree.move(event.key === 'ArrowUp' ? 'up' : 'down');
      return;
    }
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="treeitem"]')];
    const index = items.indexOf(item);
    const level = Number(item.getAttribute('aria-level'));
    const toward = (target: HTMLElement | undefined): void => {
      event.preventDefault();
      target?.focus();
    };
    if (event.key === 'ArrowDown') toward(items[index + 1]);
    else if (event.key === 'ArrowUp') toward(items[index - 1]);
    else if (event.key === 'Home') toward(items[0]);
    else if (event.key === 'End') toward(items[items.length - 1]);
    else if (event.key === 'ArrowRight') toward(Number(items[index + 1]?.getAttribute('aria-level')) > level ? items[index + 1] : undefined);
    else if (event.key === 'ArrowLeft') toward([...items.slice(0, index)].reverse().find((candidate) => Number(candidate.getAttribute('aria-level')) < level));
    else if (event.key === 'Enter' && onOpen !== undefined) {
      event.preventDefault();
      onOpen(item.dataset['partId'] ?? '');
    }
  }

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
    body = (
      <ul id={TREE_ID} role="tree" aria-label={TREE_TITLE} onKeyDown={onKeyDown} className="flex flex-col gap-s-1">
        {rows.map((row) => (
          <TreeNode key={row.part.id} row={row} selected={row.part.id === selected?.id} onFocusPart={tree.select} />
        ))}
      </ul>
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
      <DeletePartDialog target={tree.deleting} open={tree.deleteOpen} deleting={busy} onConfirm={() => void tree.confirmDelete()} onCancel={tree.cancelDelete} onCloseAutoFocus={focusTree} />
    </div>
  );
}
