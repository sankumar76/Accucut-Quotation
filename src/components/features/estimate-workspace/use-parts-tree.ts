'use client';

import { useEffect, useState } from 'react';

import type { Outcome } from '@/lib/api-client';
import { addPart, deletePart, loadTree, movePart, treeFromRefusal, type AddRequest, type PartItem, type TreeAnswer } from '@/lib/estimates/tree-client';
import { deleteGuardOf, stepOf } from '@/lib/estimates/tree-moves';

import { addedMessage, deletedMessage, renumberedMessage } from './estimate-texts';

/** Why the last change did not go through: the tree changed under the person (the fresh one is shown), a refusal in the server's words, or nothing but "it failed". */
export type TreeProblem =
  | { readonly kind: 'changed' }
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'failed' };

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
}

const slNoOf = (nodes: ReadonlyArray<PartItem>, id: string | null): string => nodes.find((node) => node.id === id)?.slNo ?? '';

/**
 * What the parts tree holds and what its buttons do (STORY-05.02 AC-1 to AC-6). The tree is read when the panel appears. Every change is one request, one at a time
 * (`busy`), and the screen shows what the server answers: the new tree, and for a part or a count that changed under the person the fresh tree with a notice, so a
 * second edit never overwrites the first (AC-6). A change is announced in words for a screen reader (`announcement`: "Part renumbered to 1.2"). The part
 * selected is the one the buttons are for; until one is chosen it is the first. Focus is not moved here: the tree moves it with the arrow keys.
 */
export function usePartsTree(estimateId: string) {
  const [nodes, setNodes] = useState<ReadonlyArray<PartItem> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<TreeProblem | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // The delete the dialog is about, and whether it is open: the dialog keeps its words while it fades out, so the target is not cleared on close.
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadTree(estimateId).then((outcome) => {
      if (cancelled) return;
      if (outcome.status === 'ok') setNodes(outcome.value.nodes);
      setLoadFailed(outcome.status !== 'ok');
    });
    return () => {
      cancelled = true;
    };
  }, [estimateId, attempt]);

  const selected = nodes?.find((node) => node.id === selectedId) ?? nodes?.[0] ?? null;

  /** Sends one change and shows what the server answers. `onDone` runs for a change that went through, with the tree it made. */
  async function change(send: () => Promise<Outcome<TreeAnswer>>, onDone: (answer: TreeAnswer) => void): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setProblem(null);
    const outcome = await send();
    setBusy(false);
    if (outcome.status === 'ok') {
      setNodes(outcome.value.nodes);
      onDone(outcome.value);
      return true;
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

  function add(kind: AddRequest['kind']): void {
    const request: AddRequest | null = kind === 'item' ? { kind } : selected === null ? null : { kind, nodeId: selected.id };
    if (request === null) return;
    void change(
      () => addPart(estimateId, request),
      (answer) => {
        setSelectedId(answer.nodeId);
        setAnnouncement(addedMessage(slNoOf(answer.nodes, answer.nodeId)));
      },
    );
  }

  function move(direction: 'up' | 'down'): void {
    if (selected === null || nodes === null) return;
    const index = stepOf(nodes, selected, direction);
    if (index === null) return;
    const { id, revision, parentId } = selected;
    void change(
      () => movePart(estimateId, { nodeId: id, revision, parentId, index }),
      (answer) => setAnnouncement(renumberedMessage(slNoOf(answer.nodes, id))),
    );
  }

  /** "Delete" on a part: the dialog opens and names how many parts would go. Nothing is sent yet. */
  function askDelete(): void {
    if (selected === null || nodes === null || busy) return;
    setProblem(null);
    setDeleting({ id: selected.id, slNo: selected.slNo, revision: selected.revision, parentId: selected.parentId, ...deleteGuardOf(nodes, selected.id) });
    setDeleteOpen(true);
  }

  async function confirmDelete(): Promise<void> {
    if (deleting === null) return;
    const { id, revision, parts, subtree, parentId } = deleting;
    // The dialog closes whatever the server says: on a refusal the notice and the fresh tree are on the page, which is where the person has to look.
    await change(
      () => deletePart(estimateId, { nodeId: id, revision, parts, subtree }),
      () => {
        setSelectedId(parentId);
        setAnnouncement(deletedMessage(parts));
      },
    );
    setDeleteOpen(false);
  }

  const cancelDelete = (): void => setDeleteOpen(false);
  const readAgain = (): void => {
    setLoadFailed(false);
    setAttempt((count) => count + 1);
  };

  return {
    nodes,
    loadFailed,
    selected,
    busy,
    problem,
    announcement,
    deleting,
    deleteOpen,
    select: setSelectedId,
    add,
    move,
    askDelete,
    confirmDelete,
    cancelDelete,
    readAgain,
  };
}

export type PartsTreeState = ReturnType<typeof usePartsTree>;
