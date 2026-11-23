'use client';

import { useEffect, useRef, type ChangeEvent } from 'react';

import type { FieldControlProps } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { decodeTreatment, encodeTreatment, isOtherTreatment } from '@/lib/estimate/treatment-value';
import { OTHER_TREATMENT_ID } from '@/lib/masters/system-entries';

import { TRY_AGAIN } from './estimate-texts';
import { FIELD_MARK } from './field-ids';
import { readOnlySelectProps } from './read-only-select';
import { TREATMENT_LOAD_FAILED, TREATMENT_LOADING, TREATMENT_OTHER_LABEL, TREATMENT_PLACEHOLDER, treatmentNoLongerListed } from './surface-texts';
import { useTreatmentOptions } from './use-treatment-options';

export interface TreatmentSelectProps {
  readonly control: FieldControlProps;
  /** The field's ID: the control's `name`. */
  readonly name: string;
  /** The longest words typed beside "Other" (the field's rule). */
  readonly maxLength: number;
  /** What the part shows: the choice as one text (`encodeTreatment`), or blank. */
  readonly text: string;
  /** True once the estimate may no longer be changed by this person, or when this control is not one a person types into. */
  readonly readOnly: boolean;
  /** Whether Enter moves on from the controls (the field's mark). */
  readonly marked: boolean;
  readonly onChange: (text: string) => void;
  /** The person made a choice, or left the box of "Other" (then with no text). */
  readonly onCommit: (override?: string) => void;
}

/**
 * Treatment / Color (G) of the part form (STORY-05.06 AC-3, AC-4, AC-6; FR-050): the treatments to choose from (`GET /api/v1/options/treatments`, names only, "Other" last, "Not applicable" among them), and,
 * for "Other", a box for the words (required, trimmed, up to the rule's length). A choice from the list is saved at once, with the entry's name as the words (the server writes the row's name and
 * ignores the text sent). "Other" is saved when the box is left, so the box is not told it is empty the moment it appears. A part that holds a treatment that is no longer in the list shows its
 * own words as the current value, with "(no longer listed)", and keeps them until another is chosen.
 */
export function TreatmentSelect({ control, name, maxLength, text, readOnly, marked, onChange, onCommit }: TreatmentSelectProps) {
  const { options, readAgain } = useTreatmentOptions();
  const otherBox = useRef<HTMLInputElement>(null);
  // "Other" was just chosen: once the render that shows its box is on the page, the box takes the focus (once).
  const focusOtherBox = useRef(false);
  const chosen = decodeTreatment(text);
  const mark = marked ? { [FIELD_MARK]: 'true' } : {};

  useEffect(() => {
    if (!focusOtherBox.current) return;
    focusOtherBox.current = false;
    otherBox.current?.focus();
  });

  const listed = options.status === 'ready' ? options.value : [];
  const stored = chosen !== null && !listed.some((option) => option.id === chosen.id) ? chosen : null;

  function choose(event: ChangeEvent<HTMLSelectElement>): void {
    // A read-only list never changes (CR-01 item 7D): it is not `disabled`, so a change that got through is refused here.
    if (readOnly) return;
    const id = event.target.value;
    if (id === '') {
      onChange('');
      onCommit('');
    } else if (isOtherTreatment(id)) {
      // The words typed before stay if "Other" is chosen again; the choice is saved once there are words.
      onChange(encodeTreatment({ id: OTHER_TREATMENT_ID, text: chosen !== null && isOtherTreatment(chosen.id) ? chosen.text : '' }));
      focusOtherBox.current = true;
    } else {
      const value = encodeTreatment({ id, text: listed.find((option) => option.id === id)?.name ?? '' });
      onChange(value);
      onCommit(value);
    }
  }

  return (
    <>
      <NativeSelect
        {...control}
        {...mark}
        {...readOnlySelectProps(readOnly)}
        name={name}
        disabled={options.status === 'failed'}
        aria-busy={options.status === 'loading' || undefined}
        value={chosen?.id ?? ''}
        onChange={choose}
      >
        <option value="">{options.status === 'loading' && chosen === null ? TREATMENT_LOADING : TREATMENT_PLACEHOLDER}</option>
        {stored === null ? null : <option value={stored.id}>{options.status === 'ready' ? treatmentNoLongerListed(stored.text) : stored.text}</option>}
        {listed.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </NativeSelect>
      {options.status === 'failed' ? (
        <div className="flex flex-wrap items-center gap-s-2 text-label text-ink-2">
          <p>{TREATMENT_LOAD_FAILED}</p>
          <Button variant="secondary" onClick={readAgain}>
            {TRY_AGAIN}
          </Button>
        </div>
      ) : null}
      {chosen !== null && isOtherTreatment(chosen.id) ? (
        <Input
          ref={otherBox}
          {...mark}
          id={`${control.id}-other`}
          name={`${name}-other`}
          aria-label={TREATMENT_OTHER_LABEL}
          aria-describedby={control['aria-describedby']}
          aria-invalid={control['aria-invalid']}
          autoComplete="off"
          enterKeyHint="next"
          maxLength={maxLength}
          readOnly={readOnly}
          aria-readonly={readOnly || undefined}
          value={chosen.text}
          onChange={(event) => onChange(encodeTreatment({ id: OTHER_TREATMENT_ID, text: event.target.value }))}
          onBlur={() => onCommit()}
        />
      ) : null}
    </>
  );
}
