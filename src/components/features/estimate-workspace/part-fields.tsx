'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { CARD_GRID, FORM_ROOT, HEAD_LINES, STATUS_LINE } from '@/components/shared/form-layout';
import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import type { FormField, FormView, MaterialChoice } from '@/lib/estimates/form-client';
import type { PartFormSeed } from '@/lib/estimates/part-form-seed';
import type { PartItem } from '@/lib/estimates/tree-client';
import { QTY_PER_ASSY_HINT } from '@/lib/estimate/quantity-hint';
import { isSectionComplete, sectionProgress, sectionWeight, shownSections, sumProgress, textOf } from '@/lib/estimates/form-values';
import { PERSISTENT_MENU_MIN_WIDTH } from '@/lib/design-tokens';
import { createSaveGate, type SaveGate } from '@/lib/estimates/save-gate';
import { FLAG_OFF, FLAG_ON } from '@/lib/estimate/treatment-value';
import { formatIst } from '@/lib/time';

import {
  FAILED_BODY,
  FORM_LOCKED,
  INPUT_HELD_LINE,
  INPUT_STUCK_BUTTON,
  INPUT_STUCK_LINE,
  INPUT_STUCK_SENTENCE,
  MISSING_CHOICE_MESSAGE,
  MISSING_NUMBER_MESSAGE,
  MISSING_OPTION_MESSAGE,
  MISSING_TEXT_MESSAGE,
  lastSavedText,
  MATERIAL_LOAD_FAILED_TITLE,
  NOT_SAVED_YET,
  PART_CHANGED_NOTICE,
  PART_LOAD_FAILED_TITLE,
  PART_SAVE_FAILED_TITLE,
  TRY_AGAIN,
} from './estimate-texts';
import { focusCalculate } from './calculate-button';
import { controlIdFor, NEXT_FIELD, PART_FORM_TITLE_ID } from './field-ids';
import { FieldRenderer } from './field-renderer';
import { PartHead } from './part-head';
import { PartFormGhost } from './part-form-ghost';
import { PartProgress } from './part-progress';
import { PictureSlot } from './picture-slot';
import { reviewField, type PartReviewState } from './review-look';
import { CONFLICT_BODY, CONFLICT_KEEP_MINE, CONFLICT_TITLE, CONFLICT_USE_NEWER, saveStatusText } from './save-texts';
import { SectionCard } from './section-card';
import { SectionStrip } from './section-strip';
import { TREATMENT_MISSING_MESSAGE } from './surface-texts';
import { SurfaceTreatments } from './surface-treatments';
import type { Loaded } from './use-form-definition';
import { TreatmentSeedContext } from './use-treatment-options';
import { useInputHeld } from './use-input-held';
import { usePartValues, type PartTarget, type SavedPart } from './use-part-form';
import type { OwnMove } from './use-parts-tree';

export interface PartFieldsProps {
  readonly estimateId: string;
  readonly part: PartTarget;
  readonly editable: boolean;
  /** The tree as it is now: the form's head says where the row sits and what it is called (DEF-097). Null until the tree is read. */
  readonly nodes: ReadonlyArray<PartItem> | null;
  readonly form: FormView;
  readonly materials: Loaded<ReadonlyArray<MaterialChoice>>;
  readonly lastSavedAt: string | null;
  readonly onSaved?: ((saved: SavedPart) => void) | undefined;
  readonly onChanged?: (() => void) | undefined;
  /** The person's own move of a row and the revision its answer gave it (QLT-839-04): taken by this form when it is for that row. */
  readonly ownMove?: OwnMove | null | undefined;
  /** Description or Part No. was left with a new text: the tree's row takes the name (AQP-447). */
  readonly onNamed?: ((id: string, label: string) => void) | undefined;
  /** A save was refused because the estimate was ignored (CR-01 item 7D). */
  readonly onServerIgnored?: (() => void) | undefined;
  readonly onWrote: (at: string) => void;
  readonly onReadMaterialsAgain: () => void;
  /** The IDs of this part's fields that Calculate found blank (STORY-05.09). Each shows the words of its blank under the field until it has a value. */
  readonly missing?: ReadonlySet<string> | undefined;
  /** What Calculate waits for: the saves in flight and the fields that show a value that is not saved (STORY-05.09). */
  readonly gate?: SaveGate | undefined;
  /** The Lead's and the Admin's read-only view of the same form (AQP-488, DEF-131 Stage 1): see `PartReview`. Absent for the Engineer, whose form is unchanged. */
  readonly review?: PartReviewState | undefined;
  /** What the page handed over for the form to start with (the Lead's review, DEF-141); absent for the Engineer, whose form reads it from the server. */
  readonly seed?: PartFormSeed | undefined;
}

const TITLE_ID = PART_FORM_TITLE_ID;

// What the Lead's read-only view leaves out (AQP-488): it saves nothing, so nothing is told when a save goes through, the tree is not read again, no part is missing, and the form has no Calculate to wait for it.
// They are in this file, not in the first load: the page that draws the view hands the form only what the server can send.
const noop = (): void => undefined;
const NONE_MISSING: ReadonlySet<string> = new Set();
const WIDE = `(min-width: ${PERSISTENT_MENU_MIN_WIDTH}px)`;

/**
 * The words under a blank that Calculate found (UX spec SCR-05 "Fields"): a choice is chosen, a number says what to do when a part needs nothing, a text is entered. QTY per Assy is a number too,
 * but it never "needs nothing": "Use 0" is not said under it (a 0 there is what STORY-05.12 warns about), and the field is told by its hint.
 */
function missingMessageOf(field: FormField): string {
  if (field.rule.type === 'treatment') return TREATMENT_MISSING_MESSAGE;
  if (field.rule.type === 'select') return MISSING_CHOICE_MESSAGE;
  if (field.rule.type === 'choice') return MISSING_OPTION_MESSAGE;
  return field.rule.type === 'number' && field.hint !== QTY_PER_ASSY_HINT ? MISSING_NUMBER_MESSAGE : MISSING_TEXT_MESSAGE;
}

/** The text a field that follows something shows: the Sl. No. of the part, or the Material Considered of the chosen material (names only, no number). */
function derivedText(field: FormField, part: PartTarget, texts: Readonly<Record<string, string>>, materials: Loaded<ReadonlyArray<MaterialChoice>>): string {
  if (field.rule.type !== 'derived') return '';
  if (field.rule.from === null) return part.slNo;
  const chosen = texts[field.rule.from] ?? '';
  if (chosen === '' || materials.status !== 'ready') return '';
  return materials.value.find((material) => material.id === chosen)?.materialConsidered ?? '';
}

/**
 * Enter moves to the next field that can be typed into, and never submits (STORY-05.03 AC-6; UX spec SCR-05 "Interactions"). Buttons and links keep their own Enter; Shift+Enter in a
 * multi-line box starts a new line; a read-only or disabled field is skipped. On the last field it moves focus to the Calculate button and never presses it (STORY-05.09 AC-9); once the estimate is prepared there is no button to take, and it falls back to the form's heading.
 */
function moveOnEnter(event: KeyboardEvent<HTMLFormElement>, title: HTMLElement | null): void {
  const target = event.target;
  if (event.key !== 'Enter' || event.nativeEvent.isComposing || !(target instanceof HTMLElement) || !target.matches(NEXT_FIELD)) return;
  if (target instanceof HTMLTextAreaElement && event.shiftKey) return;
  event.preventDefault();
  const fields = [...event.currentTarget.querySelectorAll<HTMLElement>(NEXT_FIELD)].filter((field) => !field.matches(':disabled'));
  const next = fields[fields.indexOf(target) + 1];
  if (next === undefined) {
    if (!focusCalculate()) title?.focus();
  }
  else next.focus();
}

/**
 * The form of one part (STORY-05.03 AC-1 to AC-6, AC-9; AQP-388): its title and the last save, the sections as cards in wrapping rows (side by side from 768 px, each one's share of a row following
 * its number of fields, one to a row on a phone; the form is held to one card's least width, so a reserved region beside it takes a column with no redesign, UD-4), and every field from the server's definition. It is used under a key of the part's ID.
 * Each value is the person's until the field is left, and then the part's values are saved on their own (`usePartValues`).
 */
export function PartFields({ estimateId, part, editable, nodes, form, materials, lastSavedAt, onSaved, onChanged, ownMove, onNamed, onServerIgnored, onWrote, onReadMaterialsAgain, missing = NONE_MISSING, gate, review, seed }: PartFieldsProps) {
  const allFields = form.sections.flatMap((section) => section.fields);
  const [ownGate] = useState(createSaveGate);
  // The leave guard holds the fields while a row write or a repair step is in flight (DL-488 (iv)): read-only in the frame it says so, the shaded look and the polite line only after 300 ms.
  const inputHeld = useInputHeld(gate ?? ownGate);
  const values = usePartValues({
    estimateId,
    part,
    editable,
    fields: allFields,
    onSaved: onSaved ?? noop,
    onChanged: onChanged ?? noop,
    onNamed: onNamed ?? noop,
    onServerIgnored: onServerIgnored ?? noop,
    onLocked: review?.onLocked,
    onWrote: (at) => {
      onWrote(at);
      review?.onWrote?.();
    },
    gate: gate ?? ownGate,
    seed,
  });
  // The person's own move of this part: its answer's revision is one of this form's own saves (QLT-839-04). Once for each move, by the move's own object.
  const moved = ownMove?.id === part.id ? ownMove : null;
  const takeOwnMove = useRef(values.ownMoved);
  useEffect(() => {
    takeOwnMove.current = values.ownMoved;
  });
  useEffect(() => {
    if (moved !== null) takeOwnMove.current(moved);
  }, [moved]);
  const title = useRef<HTMLHeadingElement>(null);
  // The Engineer's form draws its own title; the review's is drawn on the server above the form, and this form is labelled by it.
  const titleElement = (): HTMLElement | null => title.current ?? document.getElementById(TITLE_ID);
  // A row was chosen on the review (RO-2): once the form shows, the title takes the focus. Not on the first paint of the page, and never from a form the Engineer uses.
  const shown = values.stored.status === 'ready';
  const chosen = review?.chosen === true;
  useEffect(() => {
    if (chosen && shown) titleElement()?.focus();
  }, [chosen, shown]);
  // Under 1024 px the parts tree folds after a row is chosen, so the inputs are in view and the tree's summary (which says the open row) is one press away.
  useEffect(() => {
    if (!chosen || window.matchMedia(WIDE).matches) return;
    document.querySelector<HTMLDetailsElement>('[data-review-tree]')?.removeAttribute('open');
  }, [chosen]);

  if (values.stored.status === 'failed') {
    return (
      <Notice tone="danger" title={PART_LOAD_FAILED_TITLE}>
        <p>{FAILED_BODY}</p>
        <Button variant="secondary" className="mt-s-2" onClick={values.readAgain}>
          {TRY_AGAIN}
        </Button>
      </Notice>
    );
  }
  if (values.stored.status === 'loading') {
    // The second wait (the part's values are being read): the same ghost the page drew for the first one, from the definition this form holds, and silent because the first has said it (DEF-145, PF-1, PF-9.2).
    return <PartFormGhost form={form} head={review === undefined ? 'engineer' : 'lead'} notice={review !== undefined ? review.notice : editable ? undefined : FORM_LOCKED} editable={editable} silent />;
  }

  const problem = values.problem;
  const otherProblem = problem?.kind === 'conflict' ? (problem.also ?? null) : problem;
  const picture = values.stored.value.picture;
  // The "n of m complete" of every card, from what is typed (STORY-05.04 AC-1, AC-6): a card of placeholders has 0 of 0, so it shows no count and no check. A field the registry hides for what is
  // typed (Fasteners Qty and Cost while Fasteners is "None" or blank) is not drawn, not counted and not marked missing, and it comes back with what was typed when it shows (STORY-05.05 AC-1, AC-2).
  // A field whose save did not go through is not stored, so it is not counted (STORY-05.11 AC-7): the card and the part's line never claim a value the server does not hold.
  const notCounted = { ...values.errors, ...Object.fromEntries([...values.unstored].map((fieldId) => [fieldId, ''])) };
  const progress = shownSections(form.sections, values.texts).map((section) => ({ section, counts: sectionProgress(section, values.texts, notCounted) }));
  // A field Calculate found blank is still missing while it shows no value: typing into it takes its words away at once, and a card has none left when all its fields have one.
  const missingNeeded = (field: FormField): boolean => missing.has(field.id) && textOf(field, values.texts).trim() === '';
  const hasMissing = (section: { readonly fields: ReadonlyArray<FormField> }): boolean => section.fields.some(missingNeeded);
  const drawn = (
    <form data-part-form="" data-part-id={part.id} noValidate aria-labelledby={TITLE_ID} aria-busy={inputHeld.held || undefined} onSubmit={(event) => event.preventDefault()} onKeyDown={(event) => moveOnEnter(event, titleElement())} className={FORM_ROOT}>
      <div className={HEAD_LINES}>
        {review === undefined ? <PartHead partId={part.id} slNo={part.slNo} nodes={nodes} titleId={TITLE_ID} titleRef={title} /> : null}
        <PartProgress slNo={part.slNo} counts={sumProgress(progress.map(({ counts }) => counts))} />
        {/* The one status line of saving (STORY-05.10 AC-4, AC-5): when something was last saved (every save that stored something moves it, `onWrote`), that the form saves on its own, and, once, that the automatic
            save could not. A polite live region that is on the page from the first paint, so it speaks only when its words change, which is when a save stored something or failed, never on a silent tick. */}
        <p role="status" data-last-saved="" className={STATUS_LINE}>
          {saveStatusText(lastSavedAt === null ? NOT_SAVED_YET : lastSavedText(formatIst(new Date(lastSavedAt))), editable, values.autosaveFailedAt)}
        </p>
      </div>
      {/* The review's block always says where it stands (it is editable only while the estimate is a Draft or Prepared one, and its words say so); the Engineer's form speaks only when it is locked. */}
      {review !== undefined ? <Notice tone="info">{review.notice}</Notice> : editable ? null : <Notice tone="info">{FORM_LOCKED}</Notice>}
      {problem?.kind !== 'conflict' ? null : (
        // The part was changed somewhere else (STORY-05.08 AC-5, AC-6): what the person typed is kept under each marked field, and they choose. Nothing is sent until they do.
        <Notice tone="danger" title={CONFLICT_TITLE}>
          <p>{CONFLICT_BODY}</p>
          <div className="mt-s-2 flex flex-wrap gap-s-2">
            <Button variant="secondary" onClick={() => values.resolveConflict('mine')}>
              {CONFLICT_KEEP_MINE}
            </Button>
            <Button variant="secondary" onClick={() => values.resolveConflict('newer')}>
              {CONFLICT_USE_NEWER}
            </Button>
          </div>
        </Notice>
      )}
      {otherProblem === null ? null : (
        // A failure of another field's save while the conflict notice is up is shown beside it, not swallowed by it (review SQR-14).
        <Notice tone="danger" title={otherProblem.kind === 'changed' ? PART_CHANGED_NOTICE : otherProblem.kind === 'refused' ? otherProblem.message : PART_SAVE_FAILED_TITLE}>
          {otherProblem.kind === 'failed' ? FAILED_BODY : null}
        </Notice>
      )}
      {materials.status === 'failed' ? (
        <Notice tone="danger" title={MATERIAL_LOAD_FAILED_TITLE}>
          <p>{FAILED_BODY}</p>
          <Button variant="secondary" className="mt-s-2" onClick={onReadMaterialsAgain}>
            {TRY_AGAIN}
          </Button>
        </Notice>
      ) : null}
      <SectionStrip items={progress.map(({ section, counts }) => ({ section, complete: isSectionComplete(counts), missing: hasMissing(section) }))} />
      <div data-part-grid="" className={CARD_GRID}>
        {progress.map(({ section, counts }) => (
          <SectionCard key={section.id} section={section} progress={counts.total === 0 ? null : counts} missing={hasMissing(section)} weight={sectionWeight(section)}>
            {/* The surface treatments of a section (07) are one multi-select, drawn first in the card: a chosen one is 1 and one that is not is 0, and each is saved on its own (STORY-05.06). */}
            {section.fields.some((field) => field.rule.type === 'flag') ? (
              <SurfaceTreatments
                id={controlIdFor(section.id)}
                fields={section.fields.filter((field) => field.rule.type === 'flag')}
                texts={values.texts}
                editable={editable}
                review={review !== undefined}
                onToggle={(flag, chosen) => {
                  const text = chosen ? FLAG_ON : FLAG_OFF;
                  values.setText(flag.id, text);
                  values.commit(flag, text);
                }}
              />
            ) : null}
            {section.fields.map((field) =>
              field.rule.type === 'flag' ? null : field.rule.type === 'picture' ? (
                // The picture (Part Model, STORY-05.07) is its own control, fetched when the form opens; it is changed by its own routes and is no typed value.
                <PictureSlot
                  key={field.id}
                  field={review === undefined ? field : reviewField(field)}
                  estimateId={estimateId}
                  partId={part.id}
                  picture={picture}
                  editable={editable}
                  inTurn={values.inTurn}
                  onChanged={values.pictureSaved}
                  onConflict={onChanged ?? noop}
                  onServerIgnored={onServerIgnored ?? noop}
                />
              ) : (
                <FieldRenderer
                  key={field.id}
                  field={review === undefined ? field : reviewField(field)}
                  review={review !== undefined}
                  missing={missingNeeded(field) ? missingMessageOf(field) : undefined}
                  text={field.rule.type === 'derived' ? derivedText(field, part, values.texts, materials) : textOf(field, values.texts)}
                  error={values.errors[field.id]}
                  editable={editable}
                  held={inputHeld.held}
                  heldShown={inputHeld.shown}
                  materials={materials}
                  onChange={(text) => values.setText(field.id, text)}
                  onCommit={(override) => values.commit(field, override)}
                />
              ),
            )}
          </SectionCard>
        ))}
      </div>
      <p role="status" className="sr-only">
        {review?.chosen === true ? review.showing : values.announcement}
      </p>
    </form>
  );
  // The treatments the page handed over reach the control that needs them, deep in the form, through this context (DEF-141).
  // The hold's region (UX ruling leave-guard-slow-row-notice, R1 to R3): in the page flow directly BEFORE the form, never inside it (the form is `aria-busy` while it is held, and a region inside a busy one may not be
  // announced, QLT-845-26), and with no `aria-busy` of its own. It holds the one live voice, a polite line that is on the page from the first paint (so it speaks when its words change): from 300 ms the hold's line, from
  // 5 s the sentence of the notice and the way out. The notice itself carries no live role, and is drawn only while the fields are held (DL-489). Focus never moves to it on its own.
  const heldLine = inputHeld.tooLong ? INPUT_STUCK_LINE : inputHeld.shown ? INPUT_HELD_LINE : '';
  return (
    <TreatmentSeedContext value={seed?.treatments}>
      <div data-input-held-region="">
        <p role="status" data-input-held-line="" className="sr-only">
          {heldLine}
        </p>
        {inputHeld.tooLong ? (
          <Notice tone="warn">
            <p data-input-held-slow="">{INPUT_STUCK_SENTENCE}</p>
            <Button type="button" variant="secondary" className="mt-s-2" data-input-held-stay="" onClick={() => (gate ?? ownGate).stayOnThisRow()}>
              {INPUT_STUCK_BUTTON}
            </Button>
          </Notice>
        ) : null}
      </div>
      {drawn}
    </TreatmentSeedContext>
  );
}
