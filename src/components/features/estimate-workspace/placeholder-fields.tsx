import { ColumnTag } from '@/components/shared/column-tag';
import type { PlaceholderField } from '@/lib/estimates/form-client';

import { PLACEHOLDER_BODY, PLACEHOLDER_TITLE } from './estimate-texts';

export interface PlaceholderFieldsProps {
  /** The section's ID, so the region's own id is unique on the page. */
  readonly sectionId: string;
  readonly fields: ReadonlyArray<PlaceholderField>;
}

/**
 * The fields of a later story, drawn as a labelled placeholder region (STORY-05.04 AC-6): Treatment / Color in 01 and the eight surface treatments of 07, which STORY-05.06 builds. It lists each
 * field with its Excel letter and name, says nothing can be typed yet, and has no control, so a person cannot fill or save what the server would refuse. These fields are not in the
 * "n of m" count of their card until their story builds them. The words are about the form and name no rate, price or formula (UX-24).
 */
export function PlaceholderFields({ sectionId, fields }: PlaceholderFieldsProps) {
  const titleId = `part-placeholder-${sectionId}`;
  return (
    <div role="group" aria-labelledby={titleId} data-placeholder="" className="flex flex-col gap-s-2 rounded-md border border-dashed border-border-strong bg-surface-2 p-s-3 text-ink-2">
      <p id={titleId} className="text-label font-semibold">
        {PLACEHOLDER_TITLE}
      </p>
      <ul className="flex flex-col gap-s-1 text-body">
        {fields.map((field) => (
          <li key={field.id} className="flex items-center gap-s-2">
            <ColumnTag letter={field.letter} kind="auto" />
            <span className="min-w-0">{field.label}</span>
          </li>
        ))}
      </ul>
      <p className="text-label">{PLACEHOLDER_BODY}</p>
    </div>
  );
}
