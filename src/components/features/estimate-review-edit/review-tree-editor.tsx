'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from 'react';

import { PartsTreeList } from '@/components/shared/parts-tree-list';
import { TreeLegend } from '@/components/shared/tree-legend';
import { rowNameOf } from '@/lib/estimates/row-name';
import { nodeKindLabel } from '@/lib/estimate/node-kinds';
import { createClearedRefresh } from '@/lib/estimates/cleared-refresh';
import { addressWithRow, joinRows, removedElsewhere, type OpenRow } from '@/lib/estimates/review-tree-edit';
import { withoutFilled } from '@/lib/estimates/calculate-missing';
import type { PartFormSeed } from '@/lib/estimates/part-form-seed';
import { reviewBlocked, reviewCalculating } from '@/lib/estimates/review-save-gate';
import type { PartItem } from '@/lib/estimates/tree-client';
import type { EstimateStatus } from '@/lib/estimate/state-machine';
import type { CostNode, CostsView } from '@/server/views/schemas/costs';

import { PartHead } from '../estimate-workspace/part-head';
import { Notice } from '@/components/shared/notice';
import { blockedSummary } from '@/lib/estimate/calculate-words';

import type { CalculateSummaryProps } from '../estimate-workspace/calculate-summary';
import { ReviewForm } from '../estimate-workspace/review-form';
import { TreePanel } from '../estimate-workspace/tree-panel';
import { useLazyComponent } from '../estimate-workspace/use-lazy-component';
import { usePartsTree } from '../estimate-workspace/use-parts-tree';
import { ReviewRowLine } from '../estimate-review/review-row-line';
import { TreeRow } from '../estimate-review/review-tree-row';
import { ReviewTreeFrame } from '../estimate-review/review-tree';
import { inputsNotice, removedElsewhereLine, showingInputs, TREE_CALCULATING, TREE_CLEARED_STATUS, TREE_EMPTY, TREE_TITLE } from '../estimate-review/review-texts';

/**
 * The Lead's and the Admin's parts tree and inputs block of a Draft or a Prepared estimate that is not ignored (DEF-131 stage 2T; UX ruling `lead-admin-edit-inputs-2026-11-27.md` 4.7; FR-116): **one client
 * island that holds the selected row** and draws the review's tree with the Engineer's tree actions (the move handle, the "+", the "-" and "Add main assembly": `TreePanel` with the review's row and legends, no
 * second copy of any of them) and, beside it, the row's inputs block. Approved, Quoted and ignored estimates keep the read-only server tree (`ReviewTree`); the page chooses between the two by `treeActionsOffered`.
 *
 * **The tree is the server's, held by `usePartsTree`**: it starts from the tree the page read and handed over in the seed (the body `GET /tree` answers, built by the same `treeBody`; DEF-141), so there is no read of it when the island comes up, and it is read again only when a change, a conflict or Try again asks; every change is one request and the tree on screen is what the server answered. **The figures are the page's**, handed in as
 * the rows of the costs view and joined to the tree's rows by ID (`joinRows`): the hook never holds a figure, and a row added a moment ago shows a dash until the page is drawn again. Choosing a row is a state
 * change and a `?row=` written with \`history.replaceState\`, not a navigation, so a reload and a shared link still open the same row.
 *
 * **What a change to the parts does to the page.** Every add, move and delete raises the estimate's revision and clears the figures on the server. When the figures were current the island asks the page to be drawn
 * again **once** (\`createClearedRefresh\`, the rule of the inputs block) and says so once, politely. A refusal (the estimate was approved or ignored elsewhere) draws the page again too, which then shows the read-only tree
 * and its notice. If the open row was removed by someone else the block shows the row the tree now offers and says so once.
 */

/** The summary of a refused Recalculate: fetched when a refusal names parts (the same component as SCR-05's Calculate-blocked summary), so none of it is in the first load. */
const loadSummary = () => import('../estimate-workspace/calculate-summary').then((module) => module.CalculateSummary);

export interface ReviewTreeEditorProps {
  readonly estimateId: string;
  /** The task code, for the address of each row's inputs and cost details. */
  readonly code: string;
  readonly status: EstimateStatus;
  readonly state: CostsView['state'];
  readonly letters: CostsView['letters'];
  /** The page's rows (the costs view): the figures and counts, joined to the tree's rows by ID. */
  readonly nodes: CostsView['nodes'];
  /** The IDs of the rows of the calculation's quantity warning (STORY-06.10); empty while the figures are not current. */
  readonly warned: ReadonlyArray<string>;
  /** The Sl. No of the row the address names (`?row=`), or the first row: where the island starts. */
  readonly selectedSlNo: string | null;
  /** The selected row's revision as the server read it when the page was drawn: the block's first paint, until the tree is read. */
  readonly selectedRevision: number;
  /** What the page read for the open row (DEF-141): the form's data and the parts tree. The island starts from it and reads none of it again: the form reuses the data the server drew it with, and the tree is not read until a change or a retry asks. */
  readonly seed?: PartFormSeed | undefined;
  /** The form's loading ghost (DEF-145, PF-6), **drawn by the page on the server** and handed in as an element: the form of the first row shows it while its code and values arrive, in the place the form takes. Absent when the seed did not attach. */
  readonly ghost?: ReactNode;
}

export function ReviewTreeEditor({ estimateId, code, status, state, letters, nodes, warned, selectedSlNo, selectedRevision, seed, ghost }: ReviewTreeEditorProps) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const refresh = useCallback((): void => startRefresh(() => router.refresh()), [router]);
  const figuresCurrent = state === 'current';
  const cleared = useRef(createClearedRefresh());
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => cleared.current.sync(figuresCurrent), [figuresCurrent]);

  // A change to the parts clears the figures on the server: the page is drawn again once, when they were current, and the change is said once.
  const wrote = (): void => {
    if (!cleared.current.wrote(figuresCurrent)) return;
    setAnnouncement(TREE_CLEARED_STATUS);
    refresh();
  };

  const first = nodes.find((node) => node.slNo === selectedSlNo) ?? nodes[0] ?? null;
  // The seed of the page as it was first drawn: a page drawn again (a row chosen in the address, a refresh) hands a new one, which is never used (the open row is the island's, from here on).
  const [firstSeed] = useState(seed);
  const tree = usePartsTree(estimateId, refresh, { initialSelectedId: first?.id ?? null, onWrote: wrote, seed: firstSeed });
  // The server said no to a change (the estimate is approved, quoted or ignored now): the page is drawn again, and it then draws the read-only tree and the words that say why.
  const refused = tree.problem?.kind === 'refused';
  useEffect(() => {
    if (refused) refresh();
  }, [refused, refresh]);
  const calculating = useSyncExternalStore(reviewCalculating.subscribe, reviewCalculating.get, () => false);
  // What a refused Recalculate found missing (ED-25): the summary, a triangle on each row named and, in the open row, a message under each blank field. A field that now holds a value comes off the list.
  const blocked = useSyncExternalStore(reviewBlocked.subscribe, reviewBlocked.get, () => null);
  const blockedRequest = useSyncExternalStore(reviewBlocked.subscribe, reviewBlocked.request, () => 0);
  const summary = useLazyComponent<CalculateSummaryProps>(loadSummary, blocked !== null);
  const Summary = summary.Component;
  const missingIds = useMemo(() => new Set((blocked ?? []).map((part) => part.nodeId)), [blocked]);

  // What the page knew when it was drawn, as rows the first paint can use before the tree is read.
  const pageItems = useMemo<ReadonlyArray<PartItem>>(
    () => nodes.map(({ id, parentId, slNo, nodeKind, name }) => ({ id, parentId, slNo, nodeKind, label: name, completeness: 'EMPTY' as const, revision: id === first?.id ? selectedRevision : 0 })),
    [nodes, first?.id, selectedRevision],
  );
  const items = tree.nodes ?? pageItems;
  const pageById = useMemo(() => joinRows(items, nodes), [items, nodes]);
  const warnedIds = useMemo(() => new Set(warned), [warned]);
  const costOf = (item: PartItem): CostNode => ({ id: item.id, parentId: item.parentId, slNo: item.slNo, nodeKind: item.nodeKind, name: item.label, count: pageById.get(item.id)?.count ?? null, figures: pageById.get(item.id)?.figures ?? null });

  // The open row: the tree's once it is read, and until then the one that was chosen among the page's rows (the first paint draws those).
  const shown = tree.selected ?? items.find((item) => item.id === tree.selectedId) ?? items.find((item) => item.id === first?.id) ?? items[0] ?? null;
  const selectedId = shown?.id ?? null;
  // The page's seed is the first row's data **as it was drawn**. Once another row is shown it is dropped for good: that row opened again is read from the server (what was saved, with its revision), never from the snapshot, which
  // would show the values from before the edit and send the next save with a stale revision (DL-470 (3)). Worked out during the render, as the open row is below.
  const [seedKept, setSeedKept] = useState(true);
  if (seedKept && firstSeed !== undefined && shown !== null && shown.id !== firstSeed.partId) setSeedKept(false);
  const formSeed = seedKept ? firstSeed : undefined;
  // The row last chosen by a press on the tree: only then does the form take the focus and the tree fold under 1024 px (a row just added or the neighbour after a delete is not a choice, `PartReview.byPress`).
  const [pressedId, setPressedId] = useState<string | null>(null);
  const choose = (id: string): void => {
    // Pressing the row that is already open changes nothing (it must not turn a row that was added into one that was pressed, which would fold the tree under it).
    if (id !== selectedId) setPressedId(id);
    tree.select(id);
  };
  // The address names another row than the island's own write did (a link followed through the leave guard, Back, Forward): the island opens that row, as a press on it would. Its own write is the same row, so it changes nothing.
  const rowParam = useSearchParams().get('row');
  const [seenRow, setSeenRow] = useState(rowParam);
  if (rowParam !== seenRow) {
    setSeenRow(rowParam);
    const named = rowParam === null ? undefined : items.find((item) => item.slNo === rowParam);
    if (named !== undefined && named.id !== selectedId) choose(named.id);
  }
  const missingFields = new Set(blocked?.find((part) => part.nodeId === selectedId)?.fields.map((field) => field.fieldId));
  const renderRow = (part: PartItem, kindLabel: string) => (
    <TreeRow node={costOf(part)} kindLabel={kindLabel} state={state} code={code} warned={warnedIds.has(part.id)} selected={part.id === selectedId} missing={missingIds.has(part.id)} onChoose={choose} takesFocus={tree.wantsFocus} />
  );
  // Until the tree has been read the rows are the page's, as the server drew them (the figures are the first thing the Lead looks for); the buttons come with the tree.
  const reading = tree.nodes === null && !tree.loadFailed;

  // The row that was open, so that a row removed by someone else is told (ED-27). Worked out as the row changes, during the render, as the inputs block does for a row that was chosen.
  const [open, setOpen] = useState<OpenRow | null>(null);
  const now = tree.selected;
  if ((now?.id ?? null) !== (open?.id ?? null) || (now?.slNo ?? null) !== (open?.slNo ?? null)) {
    if (now !== null && open !== null && removedElsewhere(open, tree.nodes ?? [], tree.deleting?.removedIds ?? [])) setAnnouncement(removedElsewhereLine(open.slNo, now.slNo));
    setOpen(now === null ? null : { id: now.id, slNo: now.slNo });
  }

  // The chosen row is in the address (`?row=`), with no navigation: written when it changes, never on the first draw.
  const written = useRef(selectedSlNo);
  const shownSlNo = tree.selected?.slNo ?? null;
  useEffect(() => {
    if (shownSlNo === null || shownSlNo === written.current) return;
    written.current = shownSlNo;
    window.history.replaceState(window.history.state, '', addressWithRow(window.location.href, shownSlNo));
  }, [shownSlNo]);

  const selectedName = shown === null ? '' : `${shown.slNo} ${rowNameOf(shown.label, nodeKindLabel(shown, items))}`;
  const rowLine = shown === null ? null : <ReviewRowLine code={code} node={costOf(shown)} state={state} letters={letters} warned={warnedIds.has(shown.id)} />;

  return (
    <>
      <ReviewTreeFrame edit selectedName={selectedName} letters={letters} state={state}>
        {reading ? (
          pageItems.length === 0 ? (
            <p className="text-body text-ink-2">{TREE_EMPTY}</p>
          ) : (
            <>
              <PartsTreeList label={TREE_TITLE} nodes={pageItems} renderRow={renderRow} />
              <TreeLegend />
            </>
          )
        ) : (
          <TreePanel tree={tree} editable calculating={calculating ? TREE_CALCULATING : null} review={{ renderRow, legends: <TreeLegend /> }} />
        )}
        <p role="status" className="sr-only">
          {announcement}
        </p>
      </ReviewTreeFrame>
      {shown === null ? null : (
        <div id="row-inputs" className="min-w-0 scroll-mt-[var(--sticky-top,var(--topbar-h))]">
          {/* The row's eyebrow, title and figure line, then the form, which the title labels (UX ruling 3.6, 3.7): the same order as the read-only page. */}
          {blocked === null ? null : Summary === null ? (
            // The list's code is on its way (or could not be fetched): the sentence is the server's, and it is never missing.
            <Notice tone="danger" title={blockedSummary(blocked.length)} />
          ) : (
            <Summary parts={blocked} onChoosePart={tree.select} focusRequest={blockedRequest} />
          )}
          <PartHead partId={shown.id} slNo={shown.slNo} nodes={items} titleId="part-form-title" titleRef={null} />
          {rowLine}
          <ReviewForm
            estimateId={estimateId}
            part={{ id: shown.id, slNo: shown.slNo, revision: shown.revision }}
            editable
            seed={formSeed}
            ghost={ghost}
            nodes={items}
            missing={missingFields}
            onSaved={(saved) => {
              tree.applySaved(saved);
              if (blocked !== null) reviewBlocked.update(withoutFilled(blocked, saved.id, saved.inputs));
            }}
            onNamed={tree.applyLabel}
            onChanged={tree.readAgain}
            review={{
              notice: inputsNotice(status, false, state),
              showing: showingInputs(shown.slNo, rowNameOf(shown.label, nodeKindLabel(shown, items)), true),
              figuresCurrent,
              byPress: shown.id === pressedId,
            }}
          />
        </div>
      )}
    </>
  );
}
