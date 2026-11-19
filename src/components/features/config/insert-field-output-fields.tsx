import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { Icon } from '@/components/shared/icon';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { InsertOptions } from '@/lib/config/insert-field-client';
import { controlId, type CostDetails, type OutputDetails, type SingleOutputDetails } from '@/lib/config/insert-field-form';

import { RadioChoices, SelectField, TextField, FormulaField, type Errors } from './insert-field-controls';
import { AfterField, columnChoices, formatChoices } from './insert-field-input-fields';
import {
  COST_AFTER_LABEL,
  COST_POSITION_LABEL,
  COST_POSITION_OTHER,
  COST_POSITION_RIGHT,
  FORMAT_LABEL,
  FORMAT_PLACEHOLDER,
  FORMULA_LABEL,
  FORMULA_NOTE,
  GROUP_LABEL,
  GROUP_NONE,
  HIDE_ZERO_HINT,
  HIDE_ZERO_LABEL,
  HIDE_ZERO_NEVER,
  HIDE_ZERO_TEXT_NOTE,
  LABEL_LABEL,
  STAGE_LABEL,
  STAGE_PLACEHOLDER,
  WIDTH_HINT,
  WIDTH_LABEL,
} from './insert-field-texts';

/**
 * The controls of an output, or of the cost column of a pair (SCR-19 step 2; STORY-08.03 AC-2): label, the stage and sub-heading it is listed under in the cost details, width, number format and the formula, which is
 * typed in the letters the worksheet will have after the insert (decision D-1). The formula's own checking is the server's, on the preview and again on the save; "Letters after this insert" sits beside it (`aside`).
 */

const stagePlace = (stage: InsertOptions['stages'][number]): string => `${String(stage.number)} ${stage.name}`;

interface OutputFieldsProps {
  /** The server's prefix for these controls: `output`, or `cost` for the pair's cost column. */
  readonly path: 'output' | 'cost';
  readonly options: InsertOptions;
  readonly value: OutputDetails;
  readonly onChange: (patch: Partial<OutputDetails>) => void;
  readonly errors: Errors;
  /** Controls that come right after the label: where the field goes. */
  readonly place: ReactNode;
  /** The control that hides the line while an input is 0. */
  readonly hide: ReactNode;
  /** Beside the formula: the live list of letters. */
  readonly aside: ReactNode;
}

function OutputFields({ path, options, value, onChange, errors, place, hide, aside }: OutputFieldsProps) {
  const stage = options.stages.find((candidate) => candidate.id === value.stageId);
  // A sub-heading belongs to one stage: changing the stage clears the one chosen under the old.
  return (
    <>
      <TextField name={`${path}.label`} label={LABEL_LABEL} errors={errors} value={value.label} onChange={(label) => onChange({ label })} />
      {place}
      <SelectField
        name={`${path}.stageId`}
        label={STAGE_LABEL}
        errors={errors}
        value={value.stageId}
        onChange={(stageId) => onChange({ stageId, group: '' })}
        choices={options.stages.map((candidate) => ({ value: candidate.id, text: stagePlace(candidate) }))}
        placeholder={STAGE_PLACEHOLDER}
      />
      <SelectField
        name={`${path}.group`}
        label={GROUP_LABEL}
        errors={errors}
        value={value.group}
        onChange={(group) => onChange({ group })}
        choices={(stage?.subHeadings ?? []).map((heading) => ({ value: heading, text: heading }))}
        placeholder={GROUP_NONE}
      />
      {hide}
      <div className="grid gap-s-4 sm:grid-cols-2">
        <TextField name={`${path}.width`} label={WIDTH_LABEL} hint={WIDTH_HINT} errors={errors} value={value.width} onChange={(width) => onChange({ width })} inputMode="numeric" />
        <SelectField
          name={`${path}.numFmt`}
          label={FORMAT_LABEL}
          errors={errors}
          value={value.numFmt}
          onChange={(numFmt) => onChange({ numFmt })}
          choices={formatChoices(options)}
          placeholder={FORMAT_PLACEHOLDER}
        />
      </div>
      <FormulaField name={`${path}.formula`} label={FORMULA_LABEL} hint={FORMULA_NOTE} errors={errors} value={value.formula} onChange={(formula) => onChange({ formula })} />
      {aside}
    </>
  );
}

export interface SingleOutputFieldsProps {
  readonly options: InsertOptions;
  readonly value: SingleOutputDetails;
  readonly onChange: (patch: Partial<SingleOutputDetails>) => void;
  readonly errors: Errors;
  readonly after: { readonly value: string; readonly onChange: (value: string) => void };
  readonly aside: ReactNode;
}

/** A single output: where it goes, and the input that hides its line while it is 0 (optional). */
export function SingleOutputFields({ options, value, onChange, errors, after, aside }: SingleOutputFieldsProps) {
  return (
    <OutputFields
      path="output"
      options={options}
      value={value}
      onChange={onChange}
      errors={errors}
      aside={aside}
      place={<AfterField options={options} value={after.value} onChange={after.onChange} errors={errors} />}
      hide={
        <SelectField
          name="output.hideWhenZeroFieldId"
          label={HIDE_ZERO_LABEL}
          hint={HIDE_ZERO_HINT}
          errors={errors}
          value={value.hideWhenZeroFieldId}
          onChange={(hideWhenZeroFieldId) => onChange({ hideWhenZeroFieldId })}
          choices={columnChoices(options.columns.filter((column) => column.hideable))}
          placeholder={HIDE_ZERO_NEVER}
        />
      }
    />
  );
}

export interface CostFieldsProps {
  readonly options: InsertOptions;
  readonly value: CostDetails;
  readonly onChange: (patch: Partial<CostDetails>) => void;
  readonly errors: Errors;
  readonly aside: ReactNode;
  /** The new input is Text: it holds no number, so it cannot hide the line when it is 0 (the checkbox is off and disabled). */
  readonly inputIsText: boolean;
}

/** The cost column of a pair: right after the new input (the default) or after another column, and "hide the line when this input is 0" (default on). */
export function CostFields({ options, value, onChange, errors, aside, inputIsText }: CostFieldsProps) {
  const hideId = controlId('cost.hideWhenInputIsZero');
  const hideError = errors['cost.hideWhenInputIsZero'];
  return (
    <OutputFields
      path="cost"
      options={options}
      value={value}
      onChange={onChange}
      errors={errors}
      aside={aside}
      place={
        <>
          <RadioChoices
            group="cost-position"
            label={COST_POSITION_LABEL}
            value={value.position}
            onChange={(position) => onChange({ position })}
            choices={[
              { value: 'after-input', text: COST_POSITION_RIGHT },
              { value: 'other', text: COST_POSITION_OTHER },
            ]}
          />
          {value.position === 'other' ? (
            <AfterField name="cost.afterFieldId" label={COST_AFTER_LABEL} options={options} value={value.afterFieldId} onChange={(afterFieldId) => onChange({ afterFieldId })} errors={errors} />
          ) : null}
        </>
      }
      hide={
        <div className="flex flex-col gap-s-1">
          <div className="flex items-center gap-s-1">
            <Checkbox
              id={hideId}
              checked={value.hideWhenInputIsZero && !inputIsText}
              disabled={inputIsText}
              onCheckedChange={(checked) => onChange({ hideWhenInputIsZero: checked === true })}
              aria-describedby={`${hideId}-hint${hideError === undefined ? '' : ` ${hideId}-error`}`}
              {...(hideError === undefined ? {} : { 'aria-invalid': true })}
            />
            <Label htmlFor={hideId} className="text-body font-normal text-ink">
              {HIDE_ZERO_LABEL}
            </Label>
          </div>
          <p id={`${hideId}-hint`} className="text-label text-ink-3">
            {inputIsText ? HIDE_ZERO_TEXT_NOTE : HIDE_ZERO_HINT}
          </p>
          {hideError === undefined ? null : (
            <p id={`${hideId}-error`} className="flex items-start gap-s-1 text-label font-semibold text-danger">
              <Icon icon={CircleAlert} size="hint" className="mt-px shrink-0" />
              {hideError}
            </p>
          )}
        </div>
      }
    />
  );
}
