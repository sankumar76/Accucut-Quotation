import { ColumnTag } from '@/components/shared/column-tag';
import { isFlagOn } from '@/lib/estimate/treatment-value';
import type { FormField } from '@/lib/estimates/form-client';
import { textOf } from '@/lib/estimates/form-shown';

import { SURFACE_LABEL, SURFACE_NONE_SELECTED } from './surface-texts';

export interface TreatmentChipsProps {
  /** The section's flags (Z to AG), in the order of the form. */
  readonly fields: ReadonlyArray<FormField>;
  /** What the form shows by field ID: a flag is `1` when it is chosen. */
  readonly texts: Readonly<Record<string, string>>;
  /** The attribute that makes the block take the whole row of its card (`data-treatments` in the form, `data-ghost-wide` in the ghost: the shared `FIELDS` string matches both). */
  readonly marker: Readonly<Record<string, string>>;
  /** The label's `id`, which the list is named by: given by the form (it is one page), left out by the loading ghost, which carries no id (DEF-145, PF-9.4). */
  readonly labelId?: string | undefined;
}

/**
 * The surface treatments of the Lead's and the Admin's read-only view (AQP-488, DEF-131; UX ruling `lead-admin-edit-inputs-2026-11-27.md` 3.4): the chosen ones as chips, always visible, no pop-over, no checkbox and no
 * hint, or "None selected". **One component for the form and for its loading ghost** (DEF-145, PF-4): the ghost has the chips' own rows, so the block is the height the form gives it. No hook, no `'use client'`.
 */
export function TreatmentChips({ fields, texts, marker, labelId }: TreatmentChipsProps) {
  const chosen = fields.filter((field) => isFlagOn(textOf(field, texts)));
  return (
    <div {...marker} className="flex min-w-0 flex-col gap-s-2">
      <span {...(labelId === undefined ? {} : { id: labelId })} className="text-label font-semibold text-ink-2">
        {SURFACE_LABEL}
      </span>
      {chosen.length === 0 ? (
        <p className="text-body text-ink-2 italic">{SURFACE_NONE_SELECTED}</p>
      ) : (
        <ul {...(labelId === undefined ? {} : { 'aria-labelledby': labelId })} className="flex flex-wrap gap-s-2">
          {chosen.map((field) => (
            <li key={field.id} className="inline-flex items-center gap-s-1 rounded-md border border-border bg-surface-2 px-s-2 py-s-1 text-label text-ink">
              {field.label} <ColumnTag letter={field.letter} kind="input" /> = 1
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
