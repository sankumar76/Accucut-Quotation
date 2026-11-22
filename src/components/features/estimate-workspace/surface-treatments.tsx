'use client';

import { ChevronDown } from 'lucide-react';
import type { KeyboardEvent } from 'react';

import { ColumnTag } from '@/components/shared/column-tag';
import { Icon } from '@/components/shared/icon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { FormField } from '@/lib/estimates/form-client';
import { textOf } from '@/lib/estimates/form-values';
import { isFlagOn } from '@/lib/estimate/treatment-value';

import { SURFACE_HINT, SURFACE_LABEL, surfaceSelectedText } from './surface-texts';

export interface SurfaceTreatmentsProps {
  /** The control's `id`: the trigger's, unique on the page. */
  readonly id: string;
  /** The section's flags (Z to AG), in the order of the form. */
  readonly fields: ReadonlyArray<FormField>;
  /** What the form shows by field ID: a flag is `1` when it is chosen and anything else when it is not. */
  readonly texts: Readonly<Record<string, string>>;
  /** False once the estimate may no longer be changed by this person: the list shows the choice and nothing can be changed. */
  readonly editable: boolean;
  /** One flag was chosen or left: it is saved on its own, as `1` or `0`. */
  readonly onToggle: (field: FormField, chosen: boolean) => void;
}

/** Arrow keys move between the choices of the list (AC-2); Space chooses or leaves one (the checkbox's own key) and Escape closes the list (the popover's own). */
function moveBetweenChoices(event: KeyboardEvent<HTMLElement>): void {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const boxes = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="checkbox"]:not(:disabled)')];
  const at = boxes.findIndex((box) => box === event.target);
  if (at === -1) return;
  event.preventDefault();
  boxes[(at + (event.key === 'ArrowDown' ? 1 : boxes.length - 1)) % boxes.length]?.focus();
}

/**
 * The eight surface treatments of section 07 as one multi-select drop-down (STORY-05.06 AC-1, AC-2; FR-049): a popover of checkboxes, each with its Excel letter, and a trigger that says what is
 * chosen as text ("2 selected: Primer, Foam"). A chosen treatment is stored as 1 and one that is not as 0; choosing none is valid. The registry's flags are the list, so a treatment the registry adds
 * appears with no change here.
 */
export function SurfaceTreatments({ id, fields, texts, editable, onToggle }: SurfaceTreatmentsProps) {
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const hintId = `${id}-hint`;
  const chosen = fields.filter((field) => isFlagOn(textOf(field, texts)));

  return (
    <div data-treatments="" className="flex min-w-0 flex-col gap-s-2">
      <Label id={labelId} htmlFor={id}>
        {SURFACE_LABEL}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="secondary"
            aria-labelledby={`${labelId} ${valueId}`}
            aria-describedby={hintId}
            className="h-auto min-h-(--control-h) justify-between py-s-2 text-left leading-snug whitespace-normal"
          >
            <span id={valueId} className="min-w-0">
              {surfaceSelectedText(chosen.map((field) => field.label))}
            </span>
            <Icon icon={ChevronDown} size="small" className="shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent aria-label={SURFACE_LABEL} onKeyDown={moveBetweenChoices}>
          <div className="flex flex-col">
            {fields.map((field) => {
              const optionId = `${id}-${field.id}`;
              return (
                <div key={field.id} className="flex min-h-(--control-h) items-center gap-s-1 rounded-md hover:bg-surface-2">
                  <Checkbox id={optionId} checked={isFlagOn(textOf(field, texts))} disabled={!editable} onCheckedChange={(next) => onToggle(field, next === true)} />
                  <Label htmlFor={optionId} className="min-h-(--control-h) min-w-0 flex-1 cursor-pointer text-body font-normal text-ink">
                    <ColumnTag letter={field.letter} kind="input" /> {field.label}
                  </Label>
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      <p id={hintId} className="text-label text-ink-3">
        {SURFACE_HINT}
      </p>
    </div>
  );
}
