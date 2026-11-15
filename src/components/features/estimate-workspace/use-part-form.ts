'use client';

import { useEffect, useRef, useState } from 'react';

import type { Outcome } from '@/lib/api-client';
import { loadForm, loadMaterialOptions, loadPartInputs, PART_CHANGED_CODE, savePartInputs, type FormField, type FormView, type MaterialChoice, type PartInputs } from '@/lib/estimates/form-client';
import { readTyped } from '@/lib/estimates/form-values';
import type { SaveGate } from '@/lib/estimates/save-gate';
import type { Completeness } from '@/lib/estimates/tree-client';
import { systemClock } from '@/lib/time';

import { PART_SAVED } from './estimate-texts';

/** Something read from the server: on its way, here, or not got. */
export type Loaded<T> = { readonly status: 'loading' } | { readonly status: 'ready'; readonly value: T } | { readonly status: 'failed' };

/** Why the last save did not go through, other than a value the server refused (that is under its field): the part changed under the person, a refusal in the server's words, or "it failed". */
export type PartProblem = { readonly kind: 'changed' } | { readonly kind: 'refused'; readonly message: string } | { readonly kind: 'failed' };

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

const loadedFrom = <T>(outcome: Outcome<T>): Loaded<T> => (outcome.status === 'ok' ? { status: 'ready', value: outcome.value } : { status: 'failed' });
const LOADING = { status: 'loading' } as const;

/**
 * The form's definition and the materials (STORY-05.03 AC-1, AC-5): read once for the estimate, whatever part is shown, with "read again" for each. The sections, letters,
 * labels, hints and rules are the server's, from the registry; this holds them and draws nothing. `lastSavedAt` is the time of the last write to any part: the form's
 * start, and the moment of each save after it.
 */
export function useFormDefinition(estimateId: string) {
  const [form, setForm] = useState<Loaded<FormView>>(LOADING);
  const [materials, setMaterials] = useState<Loaded<ReadonlyArray<MaterialChoice>>>(LOADING);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void loadForm(estimateId).then((outcome) => {
      if (cancelled) return;
      setForm(loadedFrom(outcome));
      if (outcome.status === 'ok') setLastSavedAt(outcome.value.lastSavedAt);
    });
    void loadMaterialOptions().then((outcome) => {
      if (!cancelled) setMaterials(loadedFrom(outcome));
    });
    return () => {
      cancelled = true;
    };
  }, [estimateId, attempt]);

  return {
    form,
    materials,
    lastSavedAt,
    wrote: (at: string): void => setLastSavedAt(at),
    readAgain: (): void => {
      setForm(LOADING);
      setMaterials(LOADING);
      setAttempt((count) => count + 1);
    },
  };
}

export interface UsePartValuesProps {
  readonly estimateId: string;
  readonly part: PartTarget;
  /** False once the estimate may no longer be changed by this person: nothing is saved. */
  readonly editable: boolean;
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
 * a value it does not accept is under its field in its words, a part that changed under the person is read again with a notice, and nothing the person typed is dropped by a failure. The
 * Save draft button, the 30-second save and the warning on leaving are the next story's (STORY-05.08).
 */
export function usePartValues({ estimateId, part, editable, onSaved, onChanged, onWrote, gate }: UsePartValuesProps) {
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

  useEffect(() => {
    revisionRef.current = part.revision;
  }, [part.revision]);

  // What is typed here is gone with the form (it is read from the server when the part is chosen again), so nothing of it is unsaved once it is off the screen or read again.
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
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

  const clearError = (fieldId: string): void => {
    mark(fieldId, false);
    setErrors((current) => (fieldId in current ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== fieldId)) : current));
  };

  /** The person is typing: the text is theirs, and a message about the earlier text goes. */
  function setText(fieldId: string, text: string): void {
    showText(fieldId, text);
    clearError(fieldId);
  }

  /** The server did not accept the save: say why, in its words, where the person will look. */
  function explain(outcome: Exclude<Outcome<PartInputs>, { readonly status: 'ok' }>, fieldId: string): void {
    mark(fieldId, true);
    if (outcome.status === 'refused' && outcome.httpStatus === 422) {
      setErrors((current) => ({ ...current, [fieldId]: outcome.fields[fieldId] ?? Object.values(outcome.fields)[0] ?? outcome.title }));
    } else if (outcome.status === 'refused' && (outcome.code === PART_CHANGED_CODE || outcome.httpStatus === 404)) {
      // The part is not as the person saw it: read it and the tree again, and say so. What the server has is shown, not what was typed over it.
      setProblem({ kind: 'changed' });
      setStored(LOADING);
      setAttempt((count) => count + 1);
      onChanged();
    } else if (outcome.status === 'refused') {
      setProblem({ kind: 'refused', message: outcome.title });
    } else {
      setProblem({ kind: 'failed' });
    }
  }

  async function send(fieldId: string, value: string): Promise<void> {
    const outcome = await savePartInputs(estimateId, partId, { revision: revisionRef.current, values: { [fieldId]: value } });
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
    setProblem(null);
    onSaved({ id: partId, revision: outcome.value.revision, completeness: outcome.value.completeness, inputs: outcome.value.inputs });
  }

  /**
   * The person left the field (or chose from a list): read the text by the field's rule and save it if it is a change. `override` is the text of a choice, which is made at the moment
   * of the change and is not in the state yet.
   */
  function commit(field: FormField, override?: string): void {
    if (!editable || !field.editable) return;
    const check = readTyped(field.rule, override ?? textsRef.current[field.id] ?? '');
    if (!check.ok) {
      mark(field.id, true);
      setErrors((current) => ({ ...current, [field.id]: check.message }));
      return;
    }
    clearError(field.id);
    // A field with a default (Fasteners: "None") shows it again when it is left blank, and a blank over a default is the same as the default: nothing is stored for either, so leaving
    // the box alone changes nothing and a part with nothing typed stays EMPTY (STORY-05.04 AC-3).
    const standIn = (value: string | null): string | null => value ?? field.defaultValue;
    showText(field.id, standIn(check.value) ?? '');
    if (standIn(heldRef.current[field.id] ?? null) === standIn(check.value)) return;
    const value = check.value ?? '';
    queueRef.current = queueRef.current.then(() => send(field.id, value));
    gate.track(queueRef.current);
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

  return {
    stored,
    texts,
    errors,
    problem,
    announcement,
    setText,
    commit,
    inTurn,
    pictureSaved,
    readAgain: (): void => {
      setStored(LOADING);
      setAttempt((count) => count + 1);
    },
  };
}

export type PartValuesState = ReturnType<typeof usePartValues>;
