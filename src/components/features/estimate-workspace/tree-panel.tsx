'use client';

import { Plus } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { PartsTreeList } from '@/components/shared/parts-tree-list';
import { TreeLegend } from '@/components/shared/tree-legend';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { ADD_MAIN_ASSEMBLY } from '@/lib/estimates/tree-actions';
import type { PartItem } from '@/lib/estimates/tree-client';
import { stepsAt, type SiblingPlace } from '@/lib/estimates/tree-moves';

import { UNAVAILABLE_LOOK } from './add-node-trigger';
import type { DeletePartDialogProps } from './delete-part-dialog';
import {
  FAILED_BODY,
  TREE_CHANGED_NOTICE,
  TREE_EMPTY,
  TREE_FAILED_TITLE,
  TREE_LOAD_FAILED_TITLE,
  TREE_CHANGING,
  TREE_CHANGING_ID,
  TREE_LOADING,
  TREE_TITLE,
  treeRowsLabel,
  TRY_AGAIN,
} from './estimate-texts';
import { attachPressHold } from './press-hold';
import { RowActions } from './row-actions';
import { StatusLegend } from './status-legend';
import { TreeNode } from './tree-node';
import { useLazyComponent } from './use-lazy-component';
import type { PartsTreeState } from './use-parts-tree';

export interface TreePanelProps {
  readonly tree: PartsTreeState;
  /** True while the person may change the inputs (`treeActionsOffered`, which is `canEditInputs`). Otherwise the part actions are not shown at all (UX-07): the server would refuse them. */
  readonly editable: boolean;
  /** Enter on a row's link opens its form (STORY-05.03, review SQR-11): the form takes the focus. A press with a mouse or a finger only chooses the row. */
  readonly onOpen?: (id: string) => void;
  /** The parts Calculate found a missing input in (STORY-05.09): each shows a triangle. Client state from the blocked answer. */
  readonly missingIds?: ReadonlySet<string>;
  /**
   * The panel is a card of its own, with its head over a hairline (DEF-081 ruling item 10, SCR-05): the panel beside the form and the tablet's panel. False where the panel sits on a surface of its own (the phone drawer): the
   * same head, with no card around it. True when left out.
   */
  readonly framed?: boolean;
  /** Something at the right end of the card head, after the row count: the "Tree width" button, from 1024 px (AQP-426). Not drawn in the unframed head of the drawer. */
  readonly headAction?: ReactNode;
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
 * The parts tree and its actions (STORY-05.02 AC-1 to AC-3, as changed by CR-01 items 3B and 3C): the tree is a `nav` with nested lists of row links, each row with an arrow that opens and closes its branch, a kind icon,
 * the number and name, the status icon and, where the person may change the inputs, the "+" and "-" of the row (`RowActions`, in the toolbar slot of `PartsTreeList`); "Add main assembly" and the legend of the four icons are
 * at its foot, and a live region says what changed ("Part renumbered to 1.2"). **Reordering is the move handle of each row** (CR-01 item 3D, `MoveHandle`: a drag among the rows with the same parent, or a click for Move up /
 * Move down); the buttons that sat above the tree for it, and for Add and Delete, are gone. While a change is on its way every control that would start another is `aria-disabled` and keeps the focus (AQP-343). There is no arrow-key navigation: Tab moves from row to row, to each arrow and to the buttons of a row, and Enter on a row opens its form (PM
 * ruling). All of it is the screen's: every rule is the server's, and what the tree shows is what the server last answered.
 */
export function TreePanel({ tree, editable, onOpen, missingIds, framed = true, headAction }: TreePanelProps) {
  const { nodes, selected, busy } = tree;
  // Rule P (AQP-419, DEF-076): a press in the tree never moves a row between its pointer-down and its end, so the toolbars in view at the pointer-down are held until the click has run.
  useEffect(() => attachPressHold(document, window, TREE_ID), []);
  const deleteDialog = useLazyComponent<DeletePartDialogProps>(loadDeleteDialog, tree.deleting !== null);
  const DeleteDialog = deleteDialog.Component;
  // The branches that are closed. The tree opens with every branch open; what a person closes stays closed while the panel is on screen (the state is this panel's, not the server's).
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string): void => setClosed((current) => (current.has(id) ? new Set([...current].filter((other) => other !== id)) : new Set([...current, id])));
  // While a change is on its way the buttons that would start another are not offered, and once the line above the tree is on screen they are described by it (AQP-343, DL-340).
  const describedBy = tree.waiting ? TREE_CHANGING_ID : undefined;
  // The tree could not be read (the first time, or after a change that nothing answered): the Notice takes the tree's place, and after a change that nothing answered the focus goes to its button.
  const notKnown = tree.problem?.kind === 'unconfirmed';
  const retry = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (notKnown) retry.current?.focus();
  }, [notKnown]);
  // A row that was moved is drawn in its new place, and its move handle takes the focus (CR-01 item 3D, AC-8): the screen reader has the announcement, and the person keeps their place.
  const moved = tree.movedFocus;
  useEffect(() => {
    if (moved !== null) document.querySelector<HTMLElement>(`#${TREE_ID} li[data-part-row="${CSS.escape(moved.id)}"] > div [data-move-handle]`)?.focus();
  }, [moved]);
  const loadFailedNotice = (
    <Notice tone="danger" title={TREE_LOAD_FAILED_TITLE}>
      <p>{FAILED_BODY}</p>
      <Button ref={retry} variant="secondary" className="mt-s-2" onClick={tree.readAgain}>
        {TRY_AGAIN}
      </Button>
    </Notice>
  );

  // "Add main assembly" at the foot of the tree (and in the empty tree): another top-level Main Assembly, last. Not offered while the tree is still being read. A ghost button, as in the mock-up (DEF-081 item 13): red
  // words and "+", no outline, still 44 px high.
  const addMainAssembly = (
    <div>
      <Button
        variant="ghost"
        className={cn(busy && UNAVAILABLE_LOOK)}
        {...(busy ? { 'aria-disabled': true, ...(describedBy === undefined ? {} : { 'aria-describedby': describedBy }) } : {})}
        onClick={busy ? undefined : () => tree.addUnder(null, 'MAIN_ASSEMBLY')}
      >
        <Icon icon={Plus} />
        {ADD_MAIN_ASSEMBLY}
      </Button>
    </div>
  );

  let body: ReactNode;
  if ((nodes === null && tree.loadFailed) || (nodes !== null && notKnown)) {
    body = loadFailedNotice;
  } else if (nodes === null) {
    body = (
      <div role="status" aria-label={TREE_LOADING} className="flex flex-col gap-s-2">
        <Skeleton className="h-(--control-h)" />
        <Skeleton className="h-(--control-h)" />
        <Skeleton className="h-(--control-h)" />
      </div>
    );
  } else if (nodes.length === 0) {
    body = (
      <>
        <p className="text-body text-ink-2">{TREE_EMPTY}</p>
        {editable ? addMainAssembly : null}
      </>
    );
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
          renderRow={(part, kindLabel) => (
            <TreeNode part={part} kindLabel={kindLabel} selected={part.id === selected?.id} missing={missingIds?.has(part.id) ?? false} onChoose={choose} takesFocus={tree.wantsFocus} />
          )}
          {...(editable ? { renderToolbar: (part: PartItem, _kindLabel: string, place: SiblingPlace) => (
                <RowActions part={part} onAdd={tree.addUnder} onDelete={tree.askDelete} {...stepsAt(place)} onMoveTo={tree.moveTo} busy={busy} describedBy={describedBy} showing={tree.deleteOpen && tree.deleting?.id === part.id} />
              ),
            } : {})}
        />
        {/* The foot: a hairline, "Add main assembly" under it, and then the two legends (DEF-081 items 13 and 14). */}
        <div data-tree-foot="" className="flex flex-col gap-s-3 border-t border-border pt-s-3">
          {editable ? addMainAssembly : null}
          <TreeLegend />
          <StatusLegend />
        </div>
      </>
    );
  }

  const content = (
    <div className="flex min-w-0 flex-col gap-s-3">
      {tree.waiting ? (
        <p id={TREE_CHANGING_ID} className="text-body text-ink-2">
          {TREE_CHANGING}
        </p>
      ) : null}
      {tree.problem === null || tree.problem.kind === 'unconfirmed' ? null : (
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

  // The head: "Parts tree" on the left and the number of rows on the right, once the tree is known (DEF-081 item 10).
  const count = nodes === null ? null : <span className="ml-auto text-label text-ink-3">{treeRowsLabel(nodes.length)}</span>;
  if (!framed) {
    return (
      <div className="flex min-w-0 flex-col gap-s-3">
        <div className="flex items-center gap-s-3 border-b border-border pb-s-3">
          <CardTitle>{TREE_TITLE}</CardTitle>
          {count}
        </div>
        {content}
      </div>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{TREE_TITLE}</CardTitle>
        {count}
        {headAction === undefined ? null : <div className={cn(count === null && 'ml-auto')}>{headAction}</div>}
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
