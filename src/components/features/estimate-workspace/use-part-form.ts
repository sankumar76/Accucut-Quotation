'use client';

import { useEffect, useRef, useState } from 'react';

import type { Outcome } from '@/lib/api-client';
import { loadPartInputs, PART_CHANGED_CODE, parsePartInputs, savePartInputs, type FormField, type PartInputs } from '@/lib/estimates/form-client';
import { fieldVisibility, readTyped, watchersOf } from '@/lib/estimates/form-values';
import { planAfterNewerPart, type FieldConflict } from '@/lib/estimates/part-conflict';
import type { PartFormSeed } from '@/lib/estimates/part-form-seed';
import type { FlushMode, SaveGate } from '@/lib/estimates/save-gate';
import type { Completeness } from '@/lib/estimates/tree-client';
import { PART_NAME_KEYS } from '@/lib/estimate/part-name-keys';
import { systemClock } from '@/lib/time';

import { ESTIMATE_IGNORED_CODE } from '../estimate-ignore/ignore-codes';

import { PART_SAVED, partCompleteText } from './estimate-texts';
import { CONFLICT_RETRY_FAILED, conflictFieldMessage } from './save-texts';
import { useAutosaveTrail } from './use-autosave-trail';
import { LOADING, loadedFrom, type Loaded } from './use-form-definition';

/**
 * Why the last save did not go through, other than a value the server refused (that is under its field): the part is gone (read again), it changed somewhere else and the person's text is kept
 * beside the newer value (`conflict`, STORY-05.08 AC-5, AC-6), a refusal in the server's words, or "it failed".
 */
export type OtherProblem = { readonly kind: 'changed' } | { readonly kind: 'refused'; readonly message: string } | { readonly kind: 'failed' };
/** A conflict carries the failure of another field's save that came while its notice was up (`also`), so both are shown (review SQR-14). */
export type PartProblem = OtherProblem | { readonly kind: 'conflict'; readonly fields: ReadonlyArray<FieldConflict>; readonly also?: OtherProblem | undefined };

/** A save that finds the part changed reads it again and sends again what nobody else touched; a part that changes three times in a row is told to the person instead of looped on. */
const MAX_REFRESHES = 2;

/** The 409 codes of an estimate that is approved (`ESTIMATE_APPROVED_IS_LOCKED`, `state-machine.ts`) or no longer editable by this person (`ESTIMATE_NOT_EDITABLE`, `estimate-service.ts`): the server's words, read as codes. */
const LOCKED_CODES: ReadonlyArray<string> = ['ESTIMATE_APPROVED_IS_LOCKED', 'ESTIMATE_NOT_EDITABLE'];

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
  /** The person left Description or Part No. with a changed text: the row's name in the tree is now this (its Description, else its Part No., else an empty text; AQP-447, NAME-4). */
  readonly onNamed: (id: string, label: string) => void;
  /** The server refused a save with the 409 of an ignored estimate (CR-01 item 7D): the page says so once, in one alert, and nothing more is sent. */
  readonly onServerIgnored: () => void;
  /** A Lead's or an Admin's save was refused with the 409 of an estimate that is approved or no longer editable (DEF-131, ED-12): the block turns read-only and what was typed stays on screen. Absent for the Engineer, whose form is unchanged. */
  readonly onLocked?: (() => void) | undefined;
  /** A save changed the part, at this time. */
  readonly onWrote: (at: string) => void;
  /** Told about every save in flight and every field that shows a value that is not saved, so Calculate waits for the saves and does not go over such a field (STORY-05.09, review SQR-01). */
  readonly gate: SaveGate;
  /** The part's values as the page handed them over (the Lead's review, DEF-141): the form starts with them and reads nothing. Absent for the Engineer. */
  readonly seed?: PartFormSeed | undefined;
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
 * different values keeps the typed text under a message with the newer value, until the person chooses (`resolveConflict`).
 *
 * **The 30-second save** (STORY-05.10) is the same save asked for by the page's timer (`gate.flush('auto')`, `sendAgain('auto')`): it sends what is unsaved and readable through `queueSave`, and differs from a press
 * of Save draft only in what it says. Nothing under a field and no alert, because the person may be typing in it: a value the rule refuses is left unsent and unsaved, the text shown is not rewritten, and a failure
 * is one polite status (`autosaveFailedAt`, `use-autosave-trail.ts`). A conflict pauses it until the person has chosen.
 */
export function usePartValues({ estimateId, part, editable, fields, onSaved, onChanged, onNamed, onServerIgnored, onLocked, onWrote, gate, seed }: UsePartValuesProps) {
  const partId = part.id;
  // The part's values as a page handed them over (the Lead's review, DEF-141): the form starts with them and reads nothing; a read after that (a conflict, Try again) goes to the server as ever.
  const [seeded] = useState(() => (seed !== undefined && seed.estimateId === estimateId && seed.partId === part.id ? parsePartInputs(seed.part) : null));
  const [stored, setStored] = useState<Loaded<PartInputs>>(seeded === null ? LOADING : { status: 'ready', value: seeded });
  const [texts, setTexts] = useState<Readonly<Record<string, string>>>(seeded === null ? {} : seeded.inputs);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [problem, setProblem] = useState<PartProblem | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // The fields whose last save did not go through (not refused under the field, which has its own message): what is typed there is kept, but it is not stored, so the count leaves it out (STORY-05.11 AC-7).
  const [unstored, setUnstored] = useState<ReadonlySet<string>>(new Set());
  // The server's last word on the part: the polite "Part 1.1 is complete." is said only when a save makes it `COMPLETE`, not on every save (STORY-05.11 AC-8).
  const completenessRef = useRef<Completeness>(seeded === null ? 'EMPTY' : seeded.completeness);
  const [attempt, setAttempt] = useState(0);
  const [autosaveFailedAt, trail] = useAutosaveTrail();

  // What a save reads when it runs, not when it was asked for: the text of every field, the values the server holds and the revision to send.
  const textsRef = useRef<Readonly<Record<string, string>>>(seeded === null ? {} : seeded.inputs);
  const heldRef = useRef<Readonly<Record<string, string>>>(seeded === null ? {} : seeded.inputs);
  const revisionRef = useRef<number>(part.revision);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  // How many leaves (`gate.flush('leave')`: the tab hidden, the page left) have saves in the queue that are not yet run: while there is one, the saves that go out ask the browser to finish them even if the page goes away
  // (STORY-05.10 AC-7a, AC-7b). A count, not a flag, so the end of an earlier leave's queue does not take it from a later leave's saves.
  const leavingRef = useRef(0);
  // The fields that hold a newer value from somewhere else, until the person chooses: nothing sends them, so their text cannot overwrite the newer one by a blur or by Save draft (AC-6).
  const conflictRef = useRef<ReadonlySet<string>>(new Set());
  // The text of each field that a save in the queue is about to send or is sending, so the same text is not queued twice.
  const onItsWayRef = useRef(new Map<string, string>());
  // A number for each field, raised whenever a save of it is queued and whenever it falls into conflict: a save is sent only while it still holds the field's latest number.
  const ticketsRef = useRef(new Map<string, number>());

  useEffect(() => {
    revisionRef.current = part.revision;
  }, [part.revision]);

  // What is typed here is gone with the form (it is read from the server when the part is chosen again), so nothing of it is unsaved once it is off the screen or read again.
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    conflictRef.current = new Set();
    let cancelled = false;
    if (seeded !== null && attempt === 0) {
      // Nothing to read: the values came with the page. The same two steps a read ends with, for a form that has nothing typed yet.
      gate.forget(partId);
      trail.reset();
      return () => {
        live.current = false;
        gate.forget(partId);
      };
    }
    void loadPartInputs(estimateId, partId).then((outcome) => {
      if (cancelled) return;
      setStored(loadedFrom(outcome));
      if (outcome.status === 'ok') {
        gate.forget(partId);
        trail.reset();
        heldRef.current = outcome.value.inputs;
        textsRef.current = outcome.value.inputs;
        completenessRef.current = outcome.value.completeness;
        setTexts(outcome.value.inputs);
      }
    });
    return () => {
      cancelled = true;
      live.current = false;
      gate.forget(partId);
    };
  }, [estimateId, partId, attempt, gate, trail, seeded]);

  /** A field shows a value the server does not hold (or no longer does). A form that is no longer on the screen has nothing to show, so it is not marked. */
  const mark = (fieldId: string, unsaved: boolean): void => {
    if (live.current) gate.mark(partId, fieldId, unsaved);
  };

  function showText(fieldId: string, text: string): void {
    textsRef.current = { ...textsRef.current, [fieldId]: text };
    setTexts(textsRef.current);
  }

  const dropUnstored = (fieldId: string): void => setUnstored((current) => (current.has(fieldId) ? new Set([...current].filter((id) => id !== fieldId)) : current));
  const dropError = (fieldId: string): void => {
    setErrors((current) => (fieldId in current ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== fieldId)) : current));
    dropUnstored(fieldId);
  };
  const clearError = (fieldId: string): void => {
    mark(fieldId, false);
    dropError(fieldId);
  };
  const fieldOf = (fieldId: string): FormField | undefined => fields.find((candidate) => candidate.id === fieldId);

  /**
   * What the server holds for this field, or will hold once the save already on its way is answered: the value on its way, else the value held. A choice is judged against this, not against what was
   * held when an earlier save was asked for: that is the value the earlier save is about to replace, so a choice back to it would be taken for "no change" and never sent (AQP-407, DEF-065).
   * A blank on its way (a removal) is nothing stored.
   */
  function settledValue(field: FormField): string | null {
    const onItsWay = onItsWayRef.current.get(field.id);
    return onItsWay === undefined ? (heldRef.current[field.id] ?? null) : onItsWay === '' ? null : onItsWay;
  }

  /** Does this text differ from what the server holds or is about to hold (`settledValue`), read by the field's rule (the one `commit` judges by)? A text the rule cannot read is never saved, so it differs. */
  function differsFromSettled(field: FormField, text: string): boolean {
    const check = readTyped(field.rule, text);
    return !check.ok || standIn(field, settledValue(field)) !== standIn(field, check.value);
  }

  /** The person is typing: the text is theirs, a message about the earlier text goes, and the field is unsaved while what it shows is not what the server holds (the warning on leaving reads this, STORY-05.08 AC-4). */
  function setText(fieldId: string, text: string): void {
    showText(fieldId, text);
    dropError(fieldId);
    // Typing over a field that holds a newer value is a choice to keep one's own, made with the newer value in front of the person: it is no longer a conflict, and the next leave sends it.
    if (conflictRef.current.has(fieldId)) {
      conflictRef.current = new Set([...conflictRef.current].filter((id) => id !== fieldId));
      setProblem((current) => {
        if (current?.kind !== 'conflict') return current;
        const rest = current.fields.filter((conflict) => conflict.fieldId !== fieldId);
        return rest.length > 0 ? { ...current, fields: rest } : (current.also ?? null);
      });
    }
    const field = fieldOf(fieldId);
    const unsaved = field !== undefined && differsFromSettled(field, text);
    mark(fieldId, unsaved);
    // Typed back to what the server holds: nothing is left to save, so an earlier failure of the automatic save is answered.
    if (!unsaved) trail.saved(fieldId);
  }

  /** The server did not accept the save: say why, in its words, where the person will look. */
  function explain(outcome: Exclude<Outcome<PartInputs>, { readonly status: 'ok' }>, fieldId: string): void {
    // The estimate was ignored while the person typed (a save, or the 30-second one): the server's 409 says so before anything was stored. The page shows its one alert and stops the timer; nothing is shown under the field. The
    // typed value can no longer be saved by anyone, so it is not held as "unsaved": the way out of the page is the alert's Reload page, which the browser's own prompt on leaving would only get in front of.
    if (outcome.status === 'refused' && outcome.httpStatus === 409 && outcome.code === ESTIMATE_IGNORED_CODE) {
      mark(fieldId, false);
      onServerIgnored();
      return;
    }
    // The estimate was approved, quoted or taken out of the editable states elsewhere while a Lead or an Admin typed (ED-12): nothing was stored, and the block says so and stops offering the edit. What was typed stays shown.
    if (onLocked !== undefined && outcome.status === 'refused' && outcome.httpStatus === 409 && outcome.code !== undefined && LOCKED_CODES.includes(outcome.code)) {
      mark(fieldId, false);
      onLocked();
      return;
    }
    mark(fieldId, true);
    setUnstored((current) => new Set([...current, fieldId]));
    // The 30-second save that could not save (no answer, a 5xx, or the server's own rule on a field, 422) is one polite status and nothing under the field: the person may be typing there (STORY-05.10 AC-3, AC-5).
    if (trail.isAutomatic(fieldId) && (outcome.status === 'failed' || (outcome.status === 'refused' && outcome.httpStatus === 422))) {
      trail.fail(fieldId, outcome.status === 'refused' ? (onItsWayRef.current.get(fieldId) ?? '') : null);
      return;
    }
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

  /** The tree takes what a save left, and a part that has just become complete is said once, politely: not on every save (STORY-05.11 AC-8). */
  function reportSaved(saved: SavedPart): void {
    const becameComplete = saved.completeness === 'COMPLETE' && completenessRef.current !== 'COMPLETE';
    completenessRef.current = saved.completeness;
    if (becameComplete) setAnnouncement(partCompleteText(part.slNo));
    onSaved(saved);
  }

  /** Shows a problem, or none, unless fields are waiting for the person to choose between their text and a newer value: that notice has the buttons, and nothing else may take its place (review SQR-02). */
  function showProblem(next: PartProblem | null): void {
    setProblem((current) => {
      if (current?.kind !== 'conflict' || conflictRef.current.size === 0) return next;
      // The notice stays. Another field's failure is shown beside it (review SQR-14), and a good save clears that failure as it would anywhere else.
      return { ...current, also: next === null || next.kind === 'conflict' ? undefined : next };
    });
  }

  /** Makes every save already queued for this field out of date: it will not be sent, whatever happens to the conflict before it runs (review SQR-13). Answers the ticket of the save about to be queued. */
  function newTicket(fieldId: string): number {
    const ticket = (ticketsRef.current.get(fieldId) ?? 0) + 1;
    ticketsRef.current.set(fieldId, ticket);
    return ticket;
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
    reportSaved({ id: partId, revision: newer.revision, completeness: newer.completeness, inputs: newer.inputs });
    // The field whose save was refused is settled below (sent again, shown newer, or in conflict) unless its text cannot be read: that text was never sent, keeps its message and stays unsaved (review SQR-04).
    const refusedField = fieldOf(fieldId);
    if (refusedField !== undefined && readTyped(refusedField.rule, textsRef.current[fieldId] ?? '').ok) clearError(fieldId);
    for (const [adoptedId, text] of Object.entries(plan.adopt)) {
      // A save already queued for this field carries a choice that the newer value has just replaced on the screen: it is out of date, as in a conflict. Sent, it would overwrite the other side's value unseen (AQP-407, STORY-05.08 AC-6).
      newTicket(adoptedId);
      onItsWayRef.current.delete(adoptedId);
      showText(adoptedId, text);
      clearError(adoptedId);
    }
    for (const { fieldId: conflictId, newer: newerText } of plan.conflicts) {
      // A save already queued for this field is out of date from now on, even if the person has chosen before it runs (review SQR-13).
      newTicket(conflictId);
      onItsWayRef.current.delete(conflictId);
      mark(conflictId, true);
      const shown = fieldOf(conflictId)?.rule.type;
      setErrors((current) => ({ ...current, [conflictId]: conflictFieldMessage(shown === 'number' || shown === 'text' || shown === 'choice' ? newerText : null) }));
    }
    conflictRef.current = new Set([...conflictRef.current, ...plan.conflicts.map((conflict) => conflict.fieldId)]);
    // The fields in conflict now, with those still waiting from an earlier read: one notice names them all.
    setProblem((current) => {
      const waiting = current?.kind === 'conflict' ? current.fields.filter((earlier) => !plan.conflicts.some((conflict) => conflict.fieldId === earlier.fieldId)) : [];
      const fields = [...waiting, ...plan.conflicts];
      return fields.length > 0 ? { kind: 'conflict', fields, also: current?.kind === 'conflict' ? current.also : undefined } : null;
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

  /** `ticket` is the one `commit` took when it queued this save; a save sent again by a re-read has none and takes the field's current one. */
  async function send(fieldId: string, value: string, refreshed = 0, ticket = ticketsRef.current.get(fieldId) ?? 0): Promise<void> {
    // A save that was queued before a 409 can run after the re-read has found a newer value in this field: it sends nothing over the newer value, while the person has not chosen (review SQR-01) and after they
    // have, because the choice made it out of date (its ticket was taken from it, review SQR-13). A choice to keep the typed text is a new save with a new ticket.
    if (conflictRef.current.has(fieldId) || (ticketsRef.current.get(fieldId) ?? 0) !== ticket) return;
    const outcome = await savePartInputs(estimateId, partId, { revision: revisionRef.current, values: { [fieldId]: value } }, undefined, leavingRef.current > 0);
    if (outcome.status === 'refused' && outcome.httpStatus === 409 && outcome.code === PART_CHANGED_CODE && refreshed < MAX_REFRESHES) {
      await reconcile(fieldId, refreshed + 1);
      return;
    }
    if (outcome.status !== 'ok') {
      // A save that a later save of the same field has made out of date does not speak for the field: the later one is sent next, and its answer is the one shown (AQP-407).
      if ((ticketsRef.current.get(fieldId) ?? 0) === ticket) explain(outcome, fieldId);
      return;
    }
    if (outcome.value.revision !== revisionRef.current) {
      onWrote(systemClock.now().toISOString());
      setAnnouncement(PART_SAVED);
    }
    revisionRef.current = outcome.value.revision;
    heldRef.current = outcome.value.inputs;
    trail.saved(fieldId);
    // A good save of another field does not answer a conflict: its notice and its two buttons stay until the person chooses (review SQR-02).
    showProblem(null);
    reportSaved({ id: partId, revision: outcome.value.revision, completeness: outcome.value.completeness, inputs: outcome.value.inputs });
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
    if (standIn(field, settledValue(field)) === standIn(field, check.value)) return;
    nameRow(field, check.value ?? '');
    queueSave(field, check.value ?? '');
  }

  /**
   * The tree's row takes its name when a field that names it is left with a new text (AQP-447, DEF-090; ruling item 2): not on each key, and without waiting for the save. The name is the first of Description and
   * Part No. that holds a text, the committed one for the field just left and what the server holds for the other, so clearing Description falls back to Part No. (the server's rule, `partNameOf`).
   */
  function nameRow(left: FormField, value: string): void {
    if (left.nameKey === undefined) return;
    const textOf = (key: (typeof PART_NAME_KEYS)[number]): string => {
      const field = fields.find((candidate) => candidate.nameKey === key);
      return (field === undefined ? '' : field.id === left.id ? value : (settledValue(field) ?? '')).trim();
    };
    onNamed(partId, PART_NAME_KEYS.map(textOf).find((text) => text !== '') ?? '');
  }

  /** Queues the save of one field's value, behind the saves already queued. `automatic` is the 30-second save's (STORY-05.10): a failure of it is told quietly. */
  function queueSave(field: FormField, value: string, automatic = false): void {
    // The same text is already on its way (leaving the field and then pressing Save draft ask for it twice): one request, not two. A save that fails clears this, so the next leave sends it again.
    // A different text is queued behind it, and makes it out of date (the ticket): the last choice is the one that is stored.
    if (onItsWayRef.current.get(field.id) === value) return;
    onItsWayRef.current.set(field.id, value);
    if (automatic) trail.begin(field.id);
    const ticket = newTicket(field.id);
    queueRef.current = queueRef.current.then(() => send(field.id, value, 0, ticket)).finally(() => {
      // Only the field's latest save clears this: an earlier one that was made out of date by a later choice (even one of the same text, ON, OFF, ON) must not take away the value still on its way.
      if (ticketsRef.current.get(field.id) === ticket) onItsWayRef.current.delete(field.id);
      if (automatic) trail.end(field.id);
    });
    if (watchersOf(fields, field.id).length > 0) queueRef.current = queueRef.current.then(() => syncWatchers(field.id));
    gate.track(queueRef.current);
  }

  /**
   * The 30-second save of one field (STORY-05.10 AC-1, AC-3): what `commit` does when the person leaves the field, without the parts that speak or change what is shown. A text the rule cannot read (a number
   * half-typed, a value over the limit) is not sent and says nothing: it stays marked unsaved, so the warning on leaving still guards it. The text shown is never rewritten (`1.5` stays `1.5` while the
   * person types, and is shown as `1.50` when they leave), a field that shows a message is left to the person, and the text the server refused is not sent again until it changes.
   */
  function autosaveField(field: FormField): void {
    if (!editable || !field.editable) return;
    const check = readTyped(field.rule, textsRef.current[field.id] ?? '');
    if (!check.ok || errors[field.id] !== undefined) return;
    if (standIn(field, settledValue(field)) === standIn(field, check.value)) return;
    const value = check.value ?? '';
    if (trail.refusedBefore(field.id, value)) return;
    mark(field.id, false);
    dropUnstored(field.id);
    queueSave(field, value, true);
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
      } else if (settledValue(watcher) !== check.value) {
        // Sent like a queued save: it is on its way while it is sent, so leaving the field meanwhile does not send the same text again, and a save of this field queued earlier is made out of date by it (it
        // carries older text, or the same text that this one sends) instead of going after it (AQP-408, DEF-066). A save of the same text that is already queued is not sent here at all: it goes in its turn.
        const value = check.value ?? '';
        onItsWayRef.current.set(watcher.id, value);
        const ticket = newTicket(watcher.id);
        try {
          await send(watcher.id, value, 0, ticket);
        } finally {
          if (ticketsRef.current.get(watcher.id) === ticket) onItsWayRef.current.delete(watcher.id);
        }
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
    reportSaved({ id: partId, revision: saved.revision, completeness: saved.completeness, inputs: heldRef.current });
  }

  /**
   * Save draft (STORY-05.08 AC-1, AC-5): leave every field again, as if the person had tabbed through the form. A field that is the same after normalisation sends nothing (AC-2); one still being typed in,
   * and one whose last save failed, is sent. A field the registry hides is left alone, as it is by every save. Not a second save path: each goes through `commit`. `auto` is the 30-second save: the same
   * fields, through `autosaveField`, and nothing at all while a conflict waits for the person to choose (STORY-05.10 AC-6). `leave` (the tab became hidden, or the page is being left; AC-7a to AC-7e) is `auto`
   * with the requests asked to survive the page going away: a text already on its way is not queued again (`queueSave`), so a hide and then a leave send it once.
   */
  function sendAgain(mode: FlushMode = 'draft'): void {
    if (!live.current || (mode !== 'draft' && conflictRef.current.size > 0)) return;
    const leaving = mode === 'leave';
    if (leaving) leavingRef.current += 1;
    const shown = fieldVisibility(fields, textsRef.current);
    for (const field of fields) {
      if (!shown(field) || textsRef.current[field.id] === undefined) continue;
      if (mode === 'draft') commit(field);
      else autosaveField(field);
    }
    if (leaving) {
      const done = (): void => {
        leavingRef.current -= 1;
      };
      void queueRef.current.then(done, done);
    }
  }
  const sendAgainRef = useRef(sendAgain);
  useEffect(() => {
    sendAgainRef.current = sendAgain;
  });
  useEffect(() => gate.offerFlush((mode) => sendAgainRef.current(mode)), [gate]);

  /** The person chose between their text and the newer value of every field marked as changed somewhere else. Their own text goes through the one save, so it is shown to be sent. */
  function resolveConflict(choice: 'mine' | 'newer'): void {
    if (problem?.kind !== 'conflict') return;
    conflictRef.current = new Set();
    setProblem(problem.also ?? null);
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
    unstored,
    problem,
    announcement,
    /** The time of the first failure of the 30-second save that no good save has answered yet, or null (STORY-05.10 AC-5). */
    autosaveFailedAt,
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
