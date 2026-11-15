'use client';

import { useEffect, useRef, useState } from 'react';

import type { Outcome } from '@/lib/api-client';
import { loadPartInputs, PART_CHANGED_CODE, savePartInputs, type FormField, type PartInputs } from '@/lib/estimates/form-client';
import { fieldVisibility, readTyped, watchersOf } from '@/lib/estimates/form-values';
import { planAfterNewerPart, type FieldConflict } from '@/lib/estimates/part-conflict';
import type { SaveGate } from '@/lib/estimates/save-gate';
import type { Completeness } from '@/lib/estimates/tree-client';
import { systemClock } from '@/lib/time';

import { PART_SAVED } from './estimate-texts';
import { CONFLICT_RETRY_FAILED, conflictFieldMessage } from './save-texts';
import { LOADING, loadedFrom, type Loaded } from './use-form-definition';

/**
 * Why the last save did not go through, other than a value the server refused (that is under its field): the part is gone (read again), it changed somewhere else and the person's text is kept
 * beside the newer value (`conflict`, STORY-05.08 AC-5, AC-6), a refusal in the server's words, or "it failed".
 */
export type PartProblem =
  | { readonly kind: 'changed' }
  | { readonly kind: 'conflict'; readonly fields: ReadonlyArray<FieldConflict> }
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'failed' };

/** A save that finds the part changed reads it again and sends again what nobody else touched; a part that changes three times in a row is told to the person instead of looped on. */
const MAX_REFRESHES = 2;

/** What a field holds when nothing is stored for it: its default (Fasteners: "None"), or nothing. A blank over a default is the default, so leaving the box alone changes nothing. */
const standIn = (field: Pick<FormField, 'defaultValue'>, value: string | null): string | null => value ?? field.defaultValue;

/** The part the form is for: the tree's own facts about it. Its `revision` is the one a save is sent with, so a move or a save keeps the tree and the form in step. */
export interface PartTarget {
  readonly id: string;
  readonly slNo: string;
  readonly revision: number;
}

export interface SavedPart {
  readonly id: string;
  readonly revision: number;
  readonly completeness: Completeness;
  /** What the part holds now, by field ID: Calculate's list of missing fields takes the ones that now have a value off it (STORY-05.09). */
  readonly inputs: Readonly<Record<string, string>>;
}

export interface UsePartValuesProps {
  readonly estimateId: string;
  readonly part: PartTarget;
  /** False once the estimate may no longer be changed by this person: nothing is saved. */
  readonly editable: boolean;
  /** Every field of the form, in order: the ones that watch another (Fasteners Qty and Cost watch Fasteners) are saved again when what they watch changes (STORY-05.05). */
  readonly fields: ReadonlyArray<FormField>;
  /** A save went through: the tree takes the part's new revision and how complete it is. */
  readonly onSaved: (saved: SavedPart) => void;
  /** The server says the part is not as the person saw it: the tree is read again. */
  readonly onChanged: () => void;
  /** A save changed the part, at this time. */
  readonly onWrote: (at: string) => void;
  /** Told about every save in flight and every field that shows a value that is not saved, so Calculate waits for the saves and does not go over such a field (STORY-05.09, review SQR-01). */
  readonly gate: SaveGate;
}

/**
 * What one part's values are and what leaving a field does (STORY-05.03 AC-4, AC-7). It is used under a key of the part's ID, so a new part starts clean: its values are read
 * when it is chosen. Each field's text is the person's own until the field is left (or a choice is made): then it is read by the field's rule (`readTyped`, the server's rule). A wrong
 * value shows the words of the rule under the field and **keeps the typed text**; a right one that differs from what the server holds is saved on its own, with the part's revision,
 * and the text shown becomes the text the server stored (`12.5` becomes `12.50`). Saves go one at a time, so each carries the revision the one before it made. A refusal is the server's:
 * a value it does not accept is under its field in its words, and nothing the person typed is dropped by a failure.
 *
 * **Nothing typed is lost, and nothing is overwritten unseen** (STORY-05.08). A field is marked on the gate as soon as it is typed into and differs from what the server holds, and unmarked when it is
 * left and saved, so the warning on leaving knows. Save draft asks this form to send again what it shows (`sendAgain`, offered to the gate). A save refused because the part moved on (409) reads the part
 * again and plans by field (`planAfterNewerPart`): what only this tab changed is sent again with the new revision, what only the other side changed is shown as it is, and what both changed to
 * different values keeps the typed text under a message with the newer value, until the person chooses (`resolveConflict`). The 30-second save is STORY-05.10's.
 */
export function usePartValues({ estimateId, part, editable, fields, onSaved, onChanged, onWrote, gate }: UsePartValuesProps) {
  const partId = part.id;
  const [stored, setStored] = useState<Loaded<PartInputs>>(LOADING);
  const [texts, setTexts] = useState<Readonly<Record<string, string>>>({});
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [problem, setProblem] = useState<PartProblem | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [attempt, setAttempt] = useState(0);

  // What a save reads when it runs, not when it was asked for: the text of every field, the values the server holds and the revision to send.
  const textsRef = useRef<Readonly<Record<string, string>>>({});
  const heldRef = useRef<Readonly<Record<string, string>>>({});
  const revisionRef = useRef<number>(part.revision);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  // The fields that hold a newer value from somewhere else, until the person chooses: nothing sends them, so their text cannot overwrite the newer one by a blur or by Save draft (AC-6).
  const conflictRef = useRef<ReadonlySet<string>>(new Set());
  // The text of each field that a save in the queue is about to send or is sending, so the same text is not queued twice.
  const onItsWayRef = useRef(new Map<string, string>());

  useEffect(() => {
    revisionRef.current = part.revision;
  }, [part.revision]);

  // What is typed here is gone with the form (it is read from the server when the part is chosen again), so nothing of it is unsaved once it is off the screen or read again.
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    conflictRef.current = new Set();
    let cancelled = false;
    void loadPartInputs(estimateId, partId).then((outcome) => {
      if (cancelled) return;
      setStored(loadedFrom(outcome));
      if (outcome.status === 'ok') {
        gate.forget(partId);
        heldRef.current = outcome.value.inputs;
        textsRef.current = outcome.value.inputs;
        setTexts(outcome.value.inputs);
      }
    });
    return () => {
      cancelled = true;
      live.current = false;
      gate.forget(partId);
    };
  }, [estimateId, partId, attempt, gate]);

  /** A field shows a value the server does not hold (or no longer does). A form that is no longer on the screen has nothing to show, so it is not marked. */
  const mark = (fieldId: string, unsaved: boolean): void => {
    if (live.current) gate.mark(partId, fieldId, unsaved);
  };

  function showText(fieldId: string, text: string): void {
    textsRef.current = { ...textsRef.current, [fieldId]: text };
    setTexts(textsRef.current);
  }

  const dropError = (fieldId: string): void => setErrors((current) => (fieldId in current ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== fieldId)) : current));
  const clearError = (fieldId: string): void => {
    mark(fieldId, false);
    dropError(fieldId);
  };
  const fieldOf = (fieldId: string): FormField | undefined => fields.find((candidate) => candidate.id === fieldId);

  /** Does this text differ from what the server holds, read by the field's rule (the one `commit` judges by)? A text the rule cannot read is never saved, so it differs. */
  function differsFromHeld(field: FormField, text: string): boolean {
    const check = readTyped(field.rule, text);
    return !check.ok || standIn(field, heldRef.current[field.id] ?? null) !== standIn(field, check.value);
  }

  /** The person is typing: the text is theirs, a message about the earlier text goes, and the field is unsaved while what it shows is not what the server holds (the warning on leaving reads this, STORY-05.08 AC-4). */
  function setText(fieldId: string, text: string): void {
    showText(fieldId, text);
    dropError(fieldId);
    // Typing over a field that holds a newer value is a choice to keep one's own, made with the newer value in front of the person: it is no longer a conflict, and the next leave sends it.
    if (conflictRef.current.has(fieldId)) {
      conflictRef.current = new Set([...conflictRef.current].filter((id) => id !== fieldId));
      setProblem((current) => (current?.kind !== 'conflict' ? current : current.fields.length > 1 ? { kind: 'conflict', fields: current.fields.filter((conflict) => conflict.fieldId !== fieldId) } : null));
    }
    const field = fieldOf(fieldId);
    mark(fieldId, field !== undefined && differsFromHeld(field, text));
  }

  /** The server did not accept the save: say why, in its words, where the person will look. */
  function explain(outcome: Exclude<Outcome<PartInputs>, { readonly status: 'ok' }>, fieldId: string): void {
    mark(fieldId, true);
    if (outcome.status === 'refused' && outcome.httpStatus === 422) {
      setErrors((current) => ({ ...current, [fieldId]: outcome.fields[fieldId] ?? Object.values(outcome.fields)[0] ?? outcome.title }));
    } else if (outcome.status === 'refused' && outcome.httpStatus === 404) {
      // The part is gone: read it and the tree again, and say so. What the server has is shown, not what was typed over it.
      setProblem({ kind: 'changed' });
      setStored(LOADING);
      setAttempt((count) => count + 1);
      onChanged();
    } else if (outcome.status === 'refused' && outcome.code === PART_CHANGED_CODE) {
      // The part moved on again and again while it was read and sent: what was typed is kept and the person is told, not looped on.
      showProblem({ kind: 'refused', message: CONFLICT_RETRY_FAILED });
    } else if (outcome.status === 'refused') {
      showProblem({ kind: 'refused', message: outcome.title });
    } else {
      showProblem({ kind: 'failed' });
    }
  }

  /** Shows a problem, or none, unless fields are waiting for the person to choose between their text and a newer value: that notice has the buttons, and nothing else may take its place (review SQR-02). */
  function showProblem(next: PartProblem | null): void {
    setProblem((current) => (current?.kind === 'conflict' && conflictRef.current.size > 0 ? current : next));
  }

  /**
   * The part moved on since the person looked (409; STORY-05.08 AC-5, AC-6; two tabs, or two people). Nothing is overwritten and nothing typed is dropped: the part is read, the plan of
   * `planAfterNewerPart` is made, and the screen follows it. Run in turn with the saves, so what it sends again carries the revision it has just read.
   */
  async function reconcile(fieldId: string, refreshed: number): Promise<void> {
    const outcome = await loadPartInputs(estimateId, partId);
    if (outcome.status !== 'ok') {
      explain(outcome, fieldId);
      return;
    }
    const newer = outcome.value;
    const plan = planAfterNewerPart({ fields, typed: textsRef.current, held: heldRef.current, fresh: newer.inputs });
    revisionRef.current = newer.revision;
    heldRef.current = newer.inputs;
    onSaved({ id: partId, revision: newer.revision, completeness: newer.completeness, inputs: newer.inputs });
    // The field whose save was refused is settled below (sent again, shown newer, or in conflict) unless its text cannot be read: that text was never sent, keeps its message and stays unsaved (review SQR-04).
    const refusedField = fieldOf(fieldId);
    if (refusedField !== undefined && readTyped(refusedField.rule, textsRef.current[fieldId] ?? '').ok) clearError(fieldId);
    for (const [adoptedId, text] of Object.entries(plan.adopt)) {
      showText(adoptedId, text);
      clearError(adoptedId);
    }
    for (const { fieldId: conflictId, newer: newerText } of plan.conflicts) {
      mark(conflictId, true);
      const shown = fieldOf(conflictId)?.rule.type;
      setErrors((current) => ({ ...current, [conflictId]: conflictFieldMessage(shown === 'number' || shown === 'text' ? newerText : null) }));
    }
    conflictRef.current = new Set([...conflictRef.current, ...plan.conflicts.map((conflict) => conflict.fieldId)]);
    // The fields in conflict now, with those still waiting from an earlier read: one notice names them all.
    setProblem((current) => {
      const waiting = current?.kind === 'conflict' ? current.fields.filter((earlier) => !plan.conflicts.some((conflict) => conflict.fieldId === earlier.fieldId)) : [];
      const fields = [...waiting, ...plan.conflicts];
      return fields.length > 0 ? { kind: 'conflict', fields } : null;
    });
    for (const resendId of plan.resend) {
      const field = fieldOf(resendId);
      const check = field === undefined ? null : readTyped(field.rule, textsRef.current[resendId] ?? '');
      if (check?.ok === true) {
        clearError(resendId);
        await send(resendId, check.value ?? '', refreshed);
      }
    }
  }

  async function send(fieldId: string, value: string, refreshed = 0): Promise<void> {
    // A save that was queued before a 409 can run after the re-read has found a newer value in this field: it waits for the person's choice, and sends nothing over the newer value (review SQR-01).
    if (conflictRef.current.has(fieldId)) return;
    const outcome = await savePartInputs(estimateId, partId, { revision: revisionRef.current, values: { [fieldId]: value } });
    if (outcome.status === 'refused' && outcome.httpStatus === 409 && outcome.code === PART_CHANGED_CODE && refreshed < MAX_REFRESHES) {
      await reconcile(fieldId, refreshed + 1);
      return;
    }
    if (outcome.status !== 'ok') {
      explain(outcome, fieldId);
      return;
    }
    if (outcome.value.revision !== revisionRef.current) {
      onWrote(systemClock.now().toISOString());
      setAnnouncement(PART_SAVED);
    }
    revisionRef.current = outcome.value.revision;
    heldRef.current = outcome.value.inputs;
    // A good save of another field does not answer a conflict: its notice and its two buttons stay until the person chooses (review SQR-02).
    showProblem(null);
    onSaved({ id: partId, revision: outcome.value.revision, completeness: outcome.value.completeness, inputs: outcome.value.inputs });
  }

  /**
   * The person left the field (or chose from a list): read the text by the field's rule and save it if it is a change. `override` is the text of a choice, which is made at the moment
   * of the change and is not in the state yet.
   */
  function commit(field: FormField, override?: string): void {
    if (!editable || !field.editable || conflictRef.current.has(field.id)) return;
    const check = readTyped(field.rule, override ?? textsRef.current[field.id] ?? '');
    if (!check.ok) {
      mark(field.id, true);
      setErrors((current) => ({ ...current, [field.id]: check.message }));
      return;
    }
    clearError(field.id);
    // A field with a default (Fasteners: "None") shows it again when it is left blank, and a blank over a default is the same as the default: nothing is stored for either, so leaving
    // the box alone changes nothing and a part with nothing typed stays EMPTY (STORY-05.04 AC-3).
    showText(field.id, standIn(field, check.value) ?? '');
    if (standIn(field, heldRef.current[field.id] ?? null) === standIn(field, check.value)) return;
    const value = check.value ?? '';
    // The same text is already on its way (leaving the field and then pressing Save draft ask for it twice): one request, not two. A save that fails clears this, so the next leave sends it again.
    if (onItsWayRef.current.get(field.id) === value) return;
    onItsWayRef.current.set(field.id, value);
    queueRef.current = queueRef.current.then(() => send(field.id, value)).finally(() => {
      if (onItsWayRef.current.get(field.id) === value) onItsWayRef.current.delete(field.id);
    });
    if (watchersOf(fields, field.id).length > 0) queueRef.current = queueRef.current.then(() => syncWatchers(field.id));
    gate.track(queueRef.current);
  }

  /**
   * A field that others watch was saved (Fasteners: Qty and Cost, STORY-05.05 AC-2, AC-3). Run in turn, after that save, so what the server holds is known: the server stores a hidden number
   * as 0, so a Qty typed earlier is no longer what it holds. A watcher that shows now takes the text the person typed earlier back (it is kept while hidden) and saves it if it differs from what
   * the server holds, so the screen never shows a number the server does not have. A watcher that is hidden now has no message and no unsaved mark under it that nobody can see.
   */
  async function syncWatchers(watchedId: string): Promise<void> {
    const shown = fieldVisibility(fields, textsRef.current);
    for (const watcher of watchersOf(fields, watchedId)) {
      if (!shown(watcher)) {
        clearError(watcher.id);
        continue;
      }
      const typed = textsRef.current[watcher.id];
      if (typed === undefined) continue;
      const check = readTyped(watcher.rule, typed);
      if (!check.ok) {
        mark(watcher.id, true);
        setErrors((current) => ({ ...current, [watcher.id]: check.message }));
      } else if ((heldRef.current[watcher.id] ?? null) !== check.value) {
        await send(watcher.id, check.value ?? '');
      }
    }
  }

  /**
   * Runs a change of the part that is not a typed value (its picture, STORY-05.07) in turn with the saves: after every save already asked for, and before the next, so none of them is sent
   * with a revision the change has just moved. It is tracked by the gate like a save, so Calculate waits for it.
   */
  function inTurn<T>(job: () => Promise<T>): Promise<T> {
    const turn = queueRef.current.then(job);
    queueRef.current = turn.then(
      () => undefined,
      () => undefined,
    );
    gate.track(queueRef.current);
    return turn;
  }

  /** A picture was added, replaced or removed: the part's revision moved, so the next save is sent with the new one, and the tree and Calculate's list are told with what the part holds. */
  function pictureSaved(saved: { readonly revision: number; readonly completeness: Completeness }): void {
    revisionRef.current = saved.revision;
    onWrote(systemClock.now().toISOString());
    onSaved({ id: partId, revision: saved.revision, completeness: saved.completeness, inputs: heldRef.current });
  }

  /**
   * Save draft (STORY-05.08 AC-1, AC-5): leave every field again, as if the person had tabbed through the form. A field that is the same after normalisation sends nothing (AC-2); one still being typed in,
   * and one whose last save failed, is sent. A field the registry hides is left alone, as it is by every save. Not a second save path: each goes through `commit`.
   */
  function sendAgain(): void {
    if (!live.current) return;
    const shown = fieldVisibility(fields, textsRef.current);
    for (const field of fields) if (shown(field) && textsRef.current[field.id] !== undefined) commit(field);
  }
  const sendAgainRef = useRef(sendAgain);
  useEffect(() => {
    sendAgainRef.current = sendAgain;
  });
  useEffect(() => gate.offerFlush(() => sendAgainRef.current()), [gate]);

  /** The person chose between their text and the newer value of every field marked as changed somewhere else. Their own text goes through the one save, so it is shown to be sent. */
  function resolveConflict(choice: 'mine' | 'newer'): void {
    if (problem?.kind !== 'conflict') return;
    conflictRef.current = new Set();
    setProblem(null);
    for (const { fieldId, newer } of problem.fields) {
      const field = fieldOf(fieldId);
      if (choice === 'mine' && field !== undefined) {
        commit(field);
      } else {
        showText(fieldId, newer);
        clearError(fieldId);
      }
    }
  }

  return {
    stored,
    texts,
    errors,
    problem,
    announcement,
    setText,
    commit,
    resolveConflict,
    inTurn,
    pictureSaved,
    readAgain: (): void => {
      setStored(LOADING);
      setAttempt((count) => count + 1);
    },
  };
}

export type PartValuesState = ReturnType<typeof usePartValues>;
