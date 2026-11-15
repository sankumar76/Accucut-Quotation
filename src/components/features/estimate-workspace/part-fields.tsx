'use client';

import { useRef, type KeyboardEvent } from 'react';

import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { FormField, FormView, MaterialChoice } from '@/lib/estimates/form-client';
import { QTY_PER_ASSY_HINT } from '@/lib/estimate/quantity-hint';
import { isSectionComplete, sectionProgress, textOf } from '@/lib/estimates/form-values';
import type { SaveGate } from '@/lib/estimates/save-gate';
import { formatIst } from '@/lib/time';

import {
  FAILED_BODY,
  FORM_INTRO,
  FORM_LOADING,
  FORM_LOCKED,
  MISSING_CHOICE_MESSAGE,
  MISSING_NUMBER_MESSAGE,
  MISSING_TEXT_MESSAGE,
  lastSavedText,
  MATERIAL_LOAD_FAILED_TITLE,
  NOT_SAVED_YET,
  PART_CHANGED_NOTICE,
  PART_LOAD_FAILED_TITLE,
  PART_SAVE_FAILED_TITLE,
  partFormTitle,
  TRY_AGAIN,
} from './estimate-texts';
import { focusCalculate } from './calculate-button';
import { NEXT_FIELD } from './field-ids';
import { FieldRenderer } from './field-renderer';
import { PictureSlot } from './picture-slot';
import { PlaceholderFields } from './placeholder-fields';
import { SectionCard } from './section-card';
import { SectionStrip } from './section-strip';
import { usePartValues, type Loaded, type PartTarget, type SavedPart } from './use-part-form';

export interface PartFieldsProps {
  readonly estimateId: string;
  readonly part: PartTarget;
  readonly editable: boolean;
  readonly form: FormView;
  readonly materials: Loaded<ReadonlyArray<MaterialChoice>>;
  readonly lastSavedAt: string | null;
  readonly onSaved: (saved: SavedPart) => void;
  readonly onChanged: () => void;
  readonly onWrote: (at: string) => void;
  readonly onReadMaterialsAgain: () => void;
  /** The IDs of this part's fields that Calculate found blank (STORY-05.09). Each shows the words of its blank under the field until it has a value. */
  readonly missing: ReadonlySet<string>;
  /** What Calculate waits for: the saves in flight and the fields that show a value that is not saved (STORY-05.09). */
  readonly gate: SaveGate;
}

const TITLE_ID = 'part-form-title';

/**
 * The words under a blank that Calculate found (UX spec SCR-05 "Fields"): a choice is chosen, a number says what to do when a part needs nothing, a text is entered. QTY per Assy is a number too,
 * but it never "needs nothing": "Use 0" is not said under it (a 0 there is what STORY-05.12 warns about), and the field is told by its hint.
 */
function missingMessageOf(field: FormField): string {
  if (field.rule.type === 'select') return MISSING_CHOICE_MESSAGE;
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
 * multi-line box starts a new line; a read-only or disabled field is skipped. On the last field it moves focus to the Calculate button and never presses it (STORY-05.09 AC-9); once the estimate is submitted there is no button to take, and it falls back to the form's heading.
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
 * The form of one part (STORY-05.03 AC-1 to AC-6, AC-9): its title and the last save, the sections as cards in an auto-fit grid (one column on a phone, more as the width allows,
 * never narrower than 232 px, so a reserved region beside it takes a column with no redesign, UD-4), and every field from the server's definition. It is used under a key of the part's ID.
 * Each value is the person's until the field is left, and then the part's values are saved on their own (`usePartValues`).
 */
export function PartFields({ estimateId, part, editable, form, materials, lastSavedAt, onSaved, onChanged, onWrote, onReadMaterialsAgain, missing, gate }: PartFieldsProps) {
  const values = usePartValues({ estimateId, part, editable, onSaved, onChanged, onWrote, gate });
  const title = useRef<HTMLHeadingElement>(null);

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
    return (
      <div role="status" aria-label={FORM_LOADING} className="flex flex-col gap-s-3">
        <Skeleton className="h-(--control-h)" />
        <Skeleton className="h-(--control-h)" />
        <Skeleton className="h-(--control-h)" />
      </div>
    );
  }

  const problem = values.problem;
  const picture = values.stored.value.picture;
  // The "n of m complete" of every card, from what is typed (STORY-05.04 AC-1, AC-6): a card of placeholders has 0 of 0, so it shows no count and no check.
  const progress = form.sections.map((section) => ({ section, counts: sectionProgress(section, values.texts, values.errors) }));
  // A field Calculate found blank is still missing while it shows no value: typing into it takes its words away at once, and a card has none left when all its fields have one.
  const missingNeeded = (field: FormField): boolean => missing.has(field.id) && textOf(field, values.texts).trim() === '';
  const hasMissing = (section: { readonly fields: ReadonlyArray<FormField> }): boolean => section.fields.some(missingNeeded);
  return (
    <form data-part-form="" data-part-id={part.id} noValidate aria-labelledby={TITLE_ID} onSubmit={(event) => event.preventDefault()} onKeyDown={(event) => moveOnEnter(event, title.current)} className="flex min-w-0 flex-1 flex-col gap-s-4">
      <div className="flex flex-col gap-s-1">
        <h3 id={TITLE_ID} ref={title} tabIndex={-1} className="text-sub font-semibold text-ink">
          {partFormTitle(part.slNo)}
        </h3>
        <p className="text-label text-ink-3">{FORM_INTRO}</p>
        <p className="text-label text-ink-3">{lastSavedAt === null ? NOT_SAVED_YET : lastSavedText(formatIst(new Date(lastSavedAt)))}</p>
      </div>
      {editable ? null : <Notice tone="info">{FORM_LOCKED}</Notice>}
      {problem === null ? null : (
        <Notice tone="danger" title={problem.kind === 'changed' ? PART_CHANGED_NOTICE : problem.kind === 'refused' ? problem.message : PART_SAVE_FAILED_TITLE}>
          {problem.kind === 'failed' ? FAILED_BODY : null}
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
      <div data-part-grid="" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14.5rem),1fr))] gap-s-4">
        {progress.map(({ section, counts }) => (
          <SectionCard key={section.id} section={section} progress={counts.total === 0 ? null : counts} missing={hasMissing(section)}>
            {section.fields.map((field) =>
              field.rule.type === 'picture' ? (
                // The picture (Part Model, STORY-05.07) is its own control, fetched when the form opens; it is changed by its own routes and is no typed value.
                <PictureSlot
                  key={field.id}
                  field={field}
                  estimateId={estimateId}
                  partId={part.id}
                  picture={picture}
                  editable={editable}
                  inTurn={values.inTurn}
                  onChanged={values.pictureSaved}
                  onConflict={onChanged}
                />
              ) : (
                <FieldRenderer
                  key={field.id}
                  field={field}
                  missing={missingNeeded(field) ? missingMessageOf(field) : undefined}
                  text={field.rule.type === 'derived' ? derivedText(field, part, values.texts, materials) : textOf(field, values.texts)}
                  error={values.errors[field.id]}
                  editable={editable}
                  materials={materials}
                  onChange={(text) => values.setText(field.id, text)}
                  onCommit={(override) => values.commit(field, override)}
                />
              ),
            )}
            {section.reserved.length === 0 ? null : <PlaceholderFields sectionId={section.id} fields={section.reserved} />}
          </SectionCard>
        ))}
      </div>
      <p role="status" className="sr-only">
        {values.announcement}
      </p>
    </form>
  );
}
