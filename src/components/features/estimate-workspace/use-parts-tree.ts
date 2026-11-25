'use client';

import { useEffect, useRef, useState } from 'react';

import type { Outcome } from '@/lib/api-client';
import type { NodeKind } from '@/lib/estimate/node-kinds';
import { addPart, deletePart, loadTree, movePart, treeFromRefusal, type PartItem, type TreeAnswer } from '@/lib/estimates/tree-client';
import { deleteGuardOf, partsRemoved, siblingsOf } from '@/lib/estimates/tree-moves';

import { ESTIMATE_IGNORED_CODE } from '../estimate-ignore/ignore-codes';
import { addedMessage, deletedMessage, renumberedMessage, TREE_CHANGING } from './estimate-texts';

/**
 * How long a change to the tree (a move, an add or a delete) is waited for before the screen stops waiting, aborts the request and reads the tree again (AQP-343, DEF-040, DL-340). It is **longer than the
 * server's own worst case**, so the server's answer, or its 503, normally arrives first and this limit fires only when nothing answers: a connection wait of 5 s and a statement limit of 10 s
 * (`prisma-client.ts`, `transaction.ts`) make about 15 s. A shorter limit could report a failure for a change the server then makes.
 */
export const TREE_CHANGE_LIMIT_MS = 20_000;

/** A change that answers within this time says nothing extra; one that is still open after it says that it is on its way (UX spec section 6.0, the Loading rule: nothing shows for the first 300 ms). */
export const TREE_STATUS_DELAY_MS = 300;

/**
 * Why the last change did not go through: the tree changed under the person (the fresh one is shown), a refusal in the server's words, nothing but "it failed" (the tree was read again and the change is not in it),
 * or "not known" (nothing answered within the limit and the tree could not be read again either, so the tree on screen may be out of date).
 */
export type TreeProblem =
  | { readonly kind: 'changed' }
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'failed' }
  | { readonly kind: 'unconfirmed' };

/** The part a delete is about, as it was when the person pressed Delete: the dialog names this count, and the server checks it. */
export interface DeleteTarget {
  readonly id: string;
  readonly slNo: string;
  readonly revision: number;
  readonly parentId: string | null;
  /** The part and every sub-part. */
  readonly parts: number;
  /** The fingerprint of those parts with their revisions, as the dialog showed them. */
  readonly subtree: string;
  /** The IDs of those parts: the open row stays open unless it is one of them. */
  readonly removedIds: ReadonlyArray<string>;
}

const slNoOf = (nodes: ReadonlyArray<PartItem>, id: string | null): string => nodes.find((node) => node.id === id)?.slNo ?? '';

/** The same rows in the same places, with the same numbers and revisions: nothing happened to the tree. */
const sameTree = (one: ReadonlyArray<PartItem>, other: ReadonlyArray<PartItem>): boolean =>
  one.length === other.length && one.every((node, index) => node.id === other[index]?.id && node.parentId === other[index]?.parentId && node.slNo === other[index]?.slNo && node.revision === other[index]?.revision);

/** What a change that was sent looks like in the tree read afterwards, compared with the tree it was sent from: the answer it would have given, or null when the tree does not show it. */
type Landed = (fresh: ReadonlyArray<PartItem>, before: ReadonlyArray<PartItem>) => TreeAnswer | null;

interface Limited<T> {
  readonly value: T;
  /** The limit fired and the request was aborted. */
  readonly timedOut: boolean;
}

/** Runs a request with the limit: after `TREE_CHANGE_LIMIT_MS` its signal aborts it, and the answer is then the client's "failed". */
async function withinLimit<T>(run: (signal: AbortSignal) => Promise<T>, open: Set<AbortController>): Promise<Limited<T>> {
  const controller = new AbortController();
  open.add(controller);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TREE_CHANGE_LIMIT_MS);
  try {
    return { value: await run(controller.signal), timedOut };
  } finally {
    clearTimeout(timer);
    open.delete(controller);
  }
}

/**
 * What the parts tree holds and what its buttons do (STORY-05.02 AC-1 to AC-6). The tree is read when the panel appears. Every change is one request, one at a time
 * (`busy`), and the screen shows what the server answers: the new tree, and for a part or a count that changed under the person the fresh tree with a notice, so a
 * second edit never overwrites the first (AC-6). A change is announced in words for a screen reader (`announcement`: "Part renumbered to 1.2"). The part
 * selected is the one the buttons are for; until one is chosen it is the first. Focus is not moved here: the tree moves it with the arrow keys.
 */
export function usePartsTree(estimateId: string, onServerIgnored?: () => void) {
  const [nodes, setNodes] = useState<ReadonlyArray<PartItem> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A change has been open for more than `TREE_STATUS_DELAY_MS`: the screen says so.
  const [waiting, setWaiting] = useState(false);
  // The same fact as `busy`, readable at once: a press in the same moment as the answer must not see the state of the last render.
  const inFlight = useRef(false);
  // The requests that are open, aborted when the screen goes away. `gone` stops an answer that arrives after that from drawing on a screen that is no longer there.
  const openRequests = useRef(new Set<AbortController>());
  const gone = useRef(false);
  // True once the tree has been read, so a later read that fails is told (the tree on screen may be out of date) and not left silent.
  const treeRead = useRef(false);
  const [problem, setProblem] = useState<TreeProblem | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // The delete the dialog is about, and whether it is open: the dialog keeps its words while it fades out, so the target is not cleared on close.
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // The row that took the focus after it was added (CR-01 item 3C AC-3): kept in a ref, because it is read once, when the new row's link is mounted, and is not something to draw.
  const focusAfterAdd = useRef<string | null>(null);
  // The row that was moved, so that its move handle takes the focus once the tree is drawn in the new order (CR-01 item 3D, AC-8): a row that changes place in the page can lose the focus it had. A new object for every move, so the same row moved twice is two requests.
  const [movedFocus, setMovedFocus] = useState<{ readonly id: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadTree(estimateId).then((outcome) => {
      if (cancelled) return;
      if (outcome.status === 'ok') {
        treeRead.current = true;
        setNodes(outcome.value.nodes);
      } else if (treeRead.current) {
        setProblem({ kind: 'unconfirmed' });
      }
      setLoadFailed(outcome.status !== 'ok');
    });
    return () => {
      cancelled = true;
    };
  }, [estimateId, attempt]);

  useEffect(() => {
    gone.current = false;
    const open = openRequests.current;
    return () => {
      gone.current = true;
      for (const request of open) request.abort();
    };
  }, []);

  const selected = nodes?.find((node) => node.id === selectedId) ?? nodes?.[0] ?? null;

  /**
   * Sends one change and shows what the server answers. `onDone` runs for a change that went through, with the tree it made.
   *
   * **A change that is never answered** (AQP-343, DEF-040, DL-340): after `TREE_CHANGE_LIMIT_MS` the request is aborted and the tree is read again, because the server may have made the change whether or not the
   * answer came; that read has the same limit. `landed` says whether the fresh tree shows the change: if so it is announced as usual and there is no Notice. If the fresh tree is the one the change was sent from, the
   * change was not made and the Notice says so. If it is another tree, someone else changed it (the usual notice). If it cannot be read either, nothing is known and the Notice says that the parts could not be
   * loaded. `busy` lasts until the tree has been read again, so no press goes out on a revision that is out of date, and it is never left set.
   *
   * While a change is on its way the buttons that would start another are `aria-disabled` (`TreePanel`, `RowActions`), so a press is not offered; after `TREE_STATUS_DELAY_MS` the screen says what is going on
   * (`waiting`, and the same words in the live line). A call that still gets here during that time (a menu choice already made) is refused with that line on screen.
   */
  async function change(send: (signal: AbortSignal) => Promise<Outcome<TreeAnswer>>, onDone: (answer: TreeAnswer) => void, landed: Landed): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    const before = nodes ?? [];
    const slow = setTimeout(() => {
      setWaiting(true);
      setAnnouncement(TREE_CHANGING);
    }, TREE_STATUS_DELAY_MS);
    try {
      const sent = await withinLimit(send, openRequests.current);
      if (gone.current) return false;
      return sent.timedOut && sent.value.status === 'failed' ? await settleAfterLimit(before, onDone, landed) : settle(sent.value, onDone);
    } finally {
      clearTimeout(slow);
      inFlight.current = false;
      setBusy(false);
      setWaiting(false);
      // The words of the wait go with it; a result message that `onDone` set stays.
      setAnnouncement((current) => (current === TREE_CHANGING ? '' : current));
    }
  }

  /** Shows what the server answered. */
  function settle(outcome: Outcome<TreeAnswer>, onDone: (answer: TreeAnswer) => void): boolean {
    if (outcome.status === 'ok') {
      setNodes(outcome.value.nodes);
      onDone(outcome.value);
      return true;
    }
    if (outcome.status === 'refused' && outcome.httpStatus === 409 && outcome.code === ESTIMATE_IGNORED_CODE && onServerIgnored !== undefined) {
      // The estimate was ignored while the Engineer worked (CR-01 item 7D): the page's one alert says so, and the tree stays as it is, read-only from now on.
      onServerIgnored();
      return false;
    }
    const fresh = outcome.status === 'refused' ? treeFromRefusal(outcome) : null;
    if (fresh !== null) {
      setNodes(fresh);
      setProblem({ kind: 'changed' });
    } else if (outcome.status === 'refused' && outcome.httpStatus === 404) {
      // The part or the estimate is gone: read the tree again rather than show one that is out of date.
      setProblem({ kind: 'changed' });
      setAttempt((count) => count + 1);
    } else if (outcome.status === 'refused') {
      setProblem({ kind: 'refused', message: Object.values(outcome.fields)[0] ?? outcome.title });
    } else {
      setProblem({ kind: 'failed' });
    }
    return false;
  }

  /** After a change that nothing answered: the tree as the server has it now, and what that says about the change (see `change`). */
  async function settleAfterLimit(before: ReadonlyArray<PartItem>, onDone: (answer: TreeAnswer) => void, landed: Landed): Promise<boolean> {
    const reread = await withinLimit((signal) => loadTree(estimateId, undefined, signal), openRequests.current);
    if (gone.current) return false;
    if (reread.value.status !== 'ok') {
      setProblem({ kind: 'unconfirmed' });
      return false;
    }
    const fresh = reread.value.value.nodes;
    setNodes(fresh);
    const answer = landed(fresh, before);
    if (answer !== null) {
      onDone(answer);
      return true;
    }
    setProblem({ kind: sameTree(fresh, before) ? 'failed' : 'changed' });
    return false;
  }

  /** Adds a row of this kind last under the row `parentId` (null: the top level, "Add main assembly"). The new row is opened and takes the focus. The server decides whether the kind is allowed there (CR-01 item 3C). */
  function addUnder(parentId: string | null, nodeKind: NodeKind): void {
    void change(
      (signal) => addPart(estimateId, { parentId, nodeKind }, undefined, signal),
      (answer) => {
        focusAfterAdd.current = answer.nodeId;
        setSelectedId(answer.nodeId);
        setAnnouncement(addedMessage(slNoOf(answer.nodes, answer.nodeId)));
      },
      // Exactly one row is new in the tree read again, and it is under the row it was added to.
      (fresh, before) => {
        const known = new Set(before.map((node) => node.id));
        const added = fresh.filter((node) => !known.has(node.id));
        const [only] = added;
        return added.length === 1 && only?.parentId === parentId ? { nodes: fresh, nodeId: only.id } : null;
      },
    );
  }

  /** True once for the row that was just added: its link takes the focus when it is mounted. */
  function wantsFocus(id: string): boolean {
    if (focusAfterAdd.current !== id) return false;
    focusAfterAdd.current = null;
    return true;
  }

  /**
   * Moves the row `id` to the place `index` among the rows with the same parent, together with everything under it (CR-01 item 3D; A-CR01-5, confirmed 2026-11-23: never to another parent). It is what a drop of the
   * move handle and Move up / Move down of its menu both end in, so the two give the same result (AC-2). Nothing is shown in the new order before the server has answered (AC-9): the tree on screen is the server's,
   * and a 409 (the part or the tree changed under the person) or a failure leaves the row where it was, with the notice that already tells it. The moved row is announced by its new number.
   */
  function moveTo(id: string, index: number): void {
    const row = nodes?.find((node) => node.id === id);
    if (row === undefined || nodes === null) return;
    // A place that is not among the siblings is not offered by the handle or the menu; this is the guard behind them.
    if (!Number.isInteger(index) || index < 0 || index >= siblingsOf(nodes, row.parentId).length) return;
    const { revision, parentId, slNo } = row;
    void change(
      (signal) => movePart(estimateId, { nodeId: id, revision, parentId, index }, undefined, signal),
      (answer) => {
        setMovedFocus({ id });
        setAnnouncement(renumberedMessage(slNoOf(answer.nodes, id)));
      },
      // A move always changes the part's number (it goes to another place among its siblings), so a part with the number it had was not moved.
      (fresh) => (slNoOf(fresh, id) !== '' && slNoOf(fresh, id) !== slNo ? { nodes: fresh, nodeId: null } : null),
    );
  }

  /** The "-" of a row: the dialog opens and names how many parts would go. Nothing is sent yet. The row need not be the open one. */
  function askDelete(id: string): void {
    const row = nodes?.find((node) => node.id === id);
    // While a change is on its way the "-" is not offered (`aria-disabled`); this is the guard behind it.
    if (row === undefined || nodes === null || inFlight.current) return;
    setProblem(null);
    setDeleting({ id: row.id, slNo: row.slNo, revision: row.revision, parentId: row.parentId, ...deleteGuardOf(nodes, row.id), removedIds: partsRemoved(nodes, row.id).map((part) => part.id) });
    setDeleteOpen(true);
  }

  async function confirmDelete(): Promise<void> {
    if (deleting === null) return;
    const { id, revision, parts, subtree, parentId, removedIds } = deleting;
    // The dialog closes whatever the server says: on a refusal the notice and the fresh tree are on the page, which is where the person has to look.
    await change(
      (signal) => deletePart(estimateId, { nodeId: id, revision, parts, subtree }, undefined, signal),
      () => {
        // The open row stays open unless it went with the deleted ones; then its parent is open (the first row, at the top).
        setSelectedId((current) => (current !== null && removedIds.includes(current) ? parentId : current));
        setAnnouncement(deletedMessage(parts));
      },
      // The part is no longer in the tree read again.
      (fresh) => (fresh.some((node) => node.id === id) ? null : { nodes: fresh, nodeId: null }),
    );
    setDeleteOpen(false);
  }

  /**
   * What typing into a part did (STORY-05.03): a save raises the part's own revision and may change how complete it is. The tree takes both, so a move or a delete of the part is
   * sent with the revision the server has now (a delete that the person confirmed for the part as it was is refused otherwise, review SQR-01 (b)), and the part's icon is right.
   */
  function applySaved(saved: { readonly id: string; readonly revision: number; readonly completeness: PartItem['completeness'] }): void {
    setNodes((current) => (current === null ? current : current.map((node) => (node.id === saved.id ? { ...node, revision: saved.revision, completeness: saved.completeness } : node))));
  }

  const cancelDelete = (): void => setDeleteOpen(false);
  const readAgain = (): void => {
    setLoadFailed(false);
    setProblem(null);
    setAttempt((count) => count + 1);
  };

  return {
    nodes,
    loadFailed,
    selected,
    busy,
    waiting,
    movedFocus,
    problem,
    announcement,
    announce: setAnnouncement,
    deleting,
    deleteOpen,
    select: setSelectedId,
    addUnder,
    wantsFocus,
    moveTo,
    askDelete,
    confirmDelete,
    cancelDelete,
    applySaved,
    readAgain,
  };
}

export type PartsTreeState = ReturnType<typeof usePartsTree>;
