'use client';

import { useRef, type KeyboardEvent } from 'react';

import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { FormField, FormSection, FormView, MaterialChoice } from '@/lib/estimates/form-client';
import { formatIst } from '@/lib/time';

import {
  FAILED_BODY,
  FORM_INTRO,
  FORM_LOADING,
  FORM_LOCKED,
  lastSavedText,
  MATERIAL_LOAD_FAILED_TITLE,
  NOT_SAVED_YET,
  PART_CHANGED_NOTICE,
  PART_LOAD_FAILED_TITLE,
  PART_SAVE_FAILED_TITLE,
  partFormTitle,
  TRY_AGAIN,
} from './estimate-texts';
import { FIELD_MARK, FieldRenderer } from './field-renderer';
import { SectionCard } from './section-card';
import { usePartValues, type Loaded, type PartTarget, type SavedPart } from './use-part-form';

export const PART_FORM_ATTRIBUTE = 'data-part-form';

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
}

const TITLE_ID = 'part-form-title';
const NEXT_FIELD = `[${FIELD_MARK}="true"]`;

/** Enter on a part in the tree opens its form: the first field that can be typed into takes the focus (STORY-05.03, review SQR-11). */
export function focusFirstField(): void {
  document.querySelector<HTMLElement>(`[${PART_FORM_ATTRIBUTE}] ${NEXT_FIELD}`)?.focus();
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
 * multi-line box starts a new line; a read-only or disabled field is skipped. On the last field it leaves the field to the form's heading, which is where Calculate will take it (STORY-05.09).
 */
function moveOnEnter(event: KeyboardEvent<HTMLFormElement>, title: HTMLElement | null): void {
  const target = event.target;
  if (event.key !== 'Enter' || event.nativeEvent.isComposing || !(target instanceof HTMLElement) || !target.matches(NEXT_FIELD)) return;
  if (target instanceof HTMLTextAreaElement && event.shiftKey) return;
  event.preventDefault();
  const fields = [...event.currentTarget.querySelectorAll<HTMLElement>(NEXT_FIELD)].filter((field) => !field.matches(':disabled'));
  const next = fields[fields.indexOf(target) + 1];
  if (next === undefined) title?.focus();
  else next.focus();
}

/**
 * The form of one part (STORY-05.03 AC-1 to AC-6, AC-9): its title and the last save, the sections as cards in an auto-fit grid (one column on a phone, more as the width allows,
 * never narrower than 232 px, so a reserved region beside it takes a column with no redesign, UD-4), and every field from the server's definition. It is used under a key of the part's ID.
 * Each value is the person's until the field is left, and then the part's values are saved on their own (`usePartValues`).
 */
export function PartFields({ estimateId, part, editable, form, materials, lastSavedAt, onSaved, onChanged, onWrote, onReadMaterialsAgain }: PartFieldsProps) {
  const values = usePartValues({ estimateId, part, editable, onSaved, onChanged, onWrote });
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
  return (
    <form data-part-form="" noValidate aria-labelledby={TITLE_ID} onSubmit={(event) => event.preventDefault()} onKeyDown={(event) => moveOnEnter(event, title.current)} className="flex min-w-0 flex-1 flex-col gap-s-4">
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
      <div data-part-grid="" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14.5rem),1fr))] gap-s-4">
        {form.sections.map((section: FormSection) => (
          <SectionCard key={section.id} section={section}>
            {section.fields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                text={field.rule.type === 'derived' ? derivedText(field, part, values.texts, materials) : (values.texts[field.id] ?? '')}
                error={values.errors[field.id]}
                editable={editable}
                materials={materials}
                onChange={(text) => values.setText(field.id, text)}
                onCommit={(override) => values.commit(field, override)}
              />
            ))}
          </SectionCard>
        ))}
      </div>
      <p role="status" className="sr-only">
        {values.announcement}
      </p>
    </form>
  );
}
