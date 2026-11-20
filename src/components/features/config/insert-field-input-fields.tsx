import { FormField } from '@/components/shared/form-field';
import { NativeSelect } from '@/components/ui/native-select';
import { columnChoice, controlId, type InputDetails, type ValueType } from '@/lib/config/insert-field-form';
import type { InsertColumnOption, InsertOptions } from '@/lib/config/insert-field-client';

import { errorOf, RadioChoices, SelectField, TextField, type Choice, type Errors } from './insert-field-controls';
import {
  AFTER_LABEL,
  AFTER_PLACEHOLDER,
  DEFAULT_HINT,
  DEFAULT_LABEL,
  formatWords,
  FORMAT_LABEL,
  FORMAT_PLACEHOLDER,
  HINT_LABEL,
  LABEL_LABEL,
  SECTION_LABEL,
  SECTION_PLACEHOLDER,
  UNIT_LABEL,
  VALUE_TYPE_LABEL,
  VALUE_TYPE_NUMBER,
  VALUE_TYPE_TEXT,
  VISIBILITY_ALWAYS,
  VISIBILITY_LABEL,
  VISIBILITY_WHEN,
  WATCH_LABEL,
  WATCH_PLACEHOLDER,
  WIDTH_HINT,
  WIDTH_LABEL,
} from './insert-field-texts';

/**
 * The controls of the input the Admin adds (SCR-19 step 2; STORY-08.03 AC-2): label, type of value (Number or Text, decision D-2), default, where it goes, its section on the Engineer's form, the unit beside it, a
 * hint, its Excel width and number format, and a visibility rule. The server reads every one again; this draws them and reports what was typed.
 */

export const columnChoices = (columns: ReadonlyArray<InsertColumnOption>): ReadonlyArray<Choice> => columns.map((column) => ({ value: column.id, text: columnChoice(column) }));

/** The number formats the worksheet already uses, in words (AC-2: no other format is offered). */
export const formatChoices = (options: InsertOptions): ReadonlyArray<Choice> => options.numberFormats.map((format) => ({ value: format, text: formatWords(format) }));

/** "Insert after column": every column of the worksheet as `AX Soft Anodize Cost`. */
export function AfterField({
  name = 'afterFieldId',
  label = AFTER_LABEL,
  options,
  value,
  onChange,
  errors,
  hint,
}: {
  readonly name?: string;
  readonly label?: string;
  readonly options: InsertOptions;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly errors: Errors;
  readonly hint?: string;
}) {
  return (
    <SelectField name={name} label={label} {...(hint === undefined ? {} : { hint })} errors={errors} value={value} onChange={onChange} choices={columnChoices(options.columns)} placeholder={AFTER_PLACEHOLDER} />
  );
}

/** The ids of the two choices, so the type-of-value group and its labels agree. */
const VALUE_TYPE_ID = controlId('input.dataType');

function ValueTypeField({ value, onChange, errors }: { readonly value: ValueType; readonly onChange: (value: ValueType) => void; readonly errors: Errors }) {
  return (
    <FormField id={VALUE_TYPE_ID} label={VALUE_TYPE_LABEL} {...errorOf(errors, 'input.dataType')}>
      {(control) => (
        <NativeSelect {...control} value={value} onChange={(event) => onChange(event.target.value === 'text' ? 'text' : 'number')}>
          <option value="number">{VALUE_TYPE_NUMBER}</option>
          <option value="text">{VALUE_TYPE_TEXT}</option>
        </NativeSelect>
      )}
    </FormField>
  );
}

/** "Always" or "Only when another field has a value", and the field to watch (AC-2). A radio group, so the keyboard moves between the two with the arrow keys. */
function VisibilityField({
  value,
  watchFieldId,
  columns,
  onChange,
  errors,
}: {
  readonly value: InputDetails['visibility'];
  readonly watchFieldId: string;
  readonly columns: ReadonlyArray<InsertColumnOption>;
  readonly onChange: (patch: Partial<InputDetails>) => void;
  readonly errors: Errors;
}) {
  return (
    <div className="flex flex-col gap-s-3">
      <RadioChoices
        group="visibility"
        label={VISIBILITY_LABEL}
        value={value}
        onChange={(visibility) => onChange({ visibility })}
        choices={[
          { value: 'always', text: VISIBILITY_ALWAYS },
          { value: 'when', text: VISIBILITY_WHEN },
        ]}
      />
      {value === 'when' ? (
        <SelectField
          name="input.watchFieldId"
          label={WATCH_LABEL}
          errors={errors}
          value={watchFieldId}
          onChange={(next) => onChange({ watchFieldId: next })}
          choices={columnChoices(columns.filter((column) => column.watchable))}
          placeholder={WATCH_PLACEHOLDER}
        />
      ) : null}
    </div>
  );
}

export interface InputFieldsProps {
  readonly options: InsertOptions;
  readonly value: InputDetails;
  readonly onChange: (patch: Partial<InputDetails>) => void;
  readonly errors: Errors;
  /** The "insert after" control: an input's block holds it; a pair's block does too, and the cost column has its own. */
  readonly after: { readonly value: string; readonly onChange: (value: string) => void };
}

export function InputFields({ options, value, onChange, errors, after }: InputFieldsProps) {
  return (
    <>
      <TextField name="input.label" label={LABEL_LABEL} errors={errors} value={value.label} onChange={(label) => onChange({ label })} />
      <ValueTypeField value={value.dataType} onChange={(dataType) => onChange({ dataType })} errors={errors} />
      <TextField
        name="input.defaultValue"
        label={DEFAULT_LABEL}
        hint={DEFAULT_HINT}
        errors={errors}
        value={value.defaultValue}
        onChange={(defaultValue) => onChange({ defaultValue })}
        {...(value.dataType === 'number' ? { inputMode: 'decimal' as const } : {})}
      />
      <AfterField options={options} value={after.value} onChange={after.onChange} errors={errors} />
      <SelectField
        name="input.sectionId"
        label={SECTION_LABEL}
        errors={errors}
        value={value.sectionId}
        onChange={(sectionId) => onChange({ sectionId })}
        choices={options.sections.map((section) => ({ value: section.id, text: `${String(section.number).padStart(2, '0')} ${section.name}` }))}
        placeholder={SECTION_PLACEHOLDER}
      />
      <TextField name="input.unit" label={UNIT_LABEL} errors={errors} value={value.unit} onChange={(unit) => onChange({ unit })} />
      <TextField name="input.hint" label={HINT_LABEL} errors={errors} value={value.hint} onChange={(hint) => onChange({ hint })} />
      <div className="grid gap-s-4 sm:grid-cols-2">
        <TextField name="input.width" label={WIDTH_LABEL} hint={WIDTH_HINT} errors={errors} value={value.width} onChange={(width) => onChange({ width })} inputMode="numeric" />
        <SelectField
          name="input.numFmt"
          label={FORMAT_LABEL}
          errors={errors}
          value={value.numFmt}
          onChange={(numFmt) => onChange({ numFmt })}
          choices={formatChoices(options)}
          placeholder={FORMAT_PLACEHOLDER}
        />
      </div>
      <VisibilityField value={value.visibility} watchFieldId={value.watchFieldId} columns={options.columns} onChange={onChange} errors={errors} />
    </>
  );
}
