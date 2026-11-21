import type { ReactNode } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { controlId } from '@/lib/config/insert-field-form';

/**
 * The controls SCR-19's details step is made of (STORY-08.03 AC-2, AC-7, AC-10): a text box, a long text box and a list, each a `FormField` whose id comes from the server's name for it (`input.label`), so the
 * error summary's link, the message under the control and the focus after a refusal all find the same element. They hold no rule: a message is whatever the server said for that name.
 */

export type Errors = Readonly<Record<string, string>>;

/** The `error` prop for a field name: absent when the server said nothing about it (`exactOptionalPropertyTypes` does not accept `undefined`). */
export function errorOf(errors: Errors, name: string): { readonly error?: string } {
  const message = errors[name];
  return message === undefined ? {} : { error: message };
}

export interface Choice {
  readonly value: string;
  readonly text: string;
}

interface BaseProps {
  /** The server's name for the control: `input.label`, `afterFieldId`. */
  readonly name: string;
  readonly label: string;
  readonly hint?: string;
  readonly errors: Errors;
  readonly tag?: ReactNode;
}

const hintOf = (hint: string | undefined): { readonly hint?: string } => (hint === undefined ? {} : { hint });
const tagOf = (tag: ReactNode): { readonly tag?: ReactNode } => (tag === undefined ? {} : { tag });

export function TextField({
  name,
  label,
  hint,
  errors,
  tag,
  value,
  onChange,
  inputMode,
}: BaseProps & { readonly value: string; readonly onChange: (value: string) => void; readonly inputMode?: 'decimal' | 'numeric' }) {
  return (
    <FormField id={controlId(name)} label={label} {...hintOf(hint)} {...tagOf(tag)} {...errorOf(errors, name)}>
      {(control) => <Input {...control} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="off" {...(inputMode === undefined ? {} : { inputMode })} />}
    </FormField>
  );
}

/** A long text box for a list typed one item per line (the choices of a choice input); the same field as `TextField`, with rows. */
export function LinesField({ name, label, hint, errors, tag, value, onChange }: BaseProps & { readonly value: string; readonly onChange: (value: string) => void }) {
  return (
    <FormField id={controlId(name)} label={label} {...hintOf(hint)} {...tagOf(tag)} {...errorOf(errors, name)}>
      {(control) => <Textarea {...control} rows={5} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="off" />}
    </FormField>
  );
}

export function FormulaField({ name, label, hint, errors, tag, value, onChange, describedBy }: BaseProps & { readonly value: string; readonly onChange: (value: string) => void; readonly describedBy?: string }) {
  return (
    <FormField id={controlId(name)} label={label} {...hintOf(hint)} {...tagOf(tag)} {...errorOf(errors, name)}>
      {(control) => (
        <Textarea
          {...control}
          aria-describedby={[control['aria-describedby'], describedBy].filter((part): part is string => part !== undefined).join(' ') || undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
        />
      )}
    </FormField>
  );
}

/** A list whose first, empty choice says what to choose (`placeholder`) or what leaving it empty means ("Never hide"). */
export function SelectField({
  name,
  label,
  hint,
  errors,
  tag,
  value,
  onChange,
  choices,
  placeholder,
}: BaseProps & { readonly value: string; readonly onChange: (value: string) => void; readonly choices: ReadonlyArray<Choice>; readonly placeholder: string }) {
  return (
    <FormField id={controlId(name)} label={label} {...hintOf(hint)} {...tagOf(tag)} {...errorOf(errors, name)}>
      {(control) => (
        <NativeSelect {...control} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">{placeholder}</option>
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.text}
            </option>
          ))}
        </NativeSelect>
      )}
    </FormField>
  );
}

/** A group of radio buttons under a visible label: the arrow keys move between the choices, and the group is named by the label. `group` makes the ids unique on the page. */
export function RadioChoices<T extends string>({
  group,
  label,
  value,
  onChange,
  choices,
}: {
  readonly group: string;
  readonly label: string;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly choices: ReadonlyArray<{ readonly value: T; readonly text: string }>;
}) {
  const labelId = `insert-${group}-label`;
  return (
    <div className="flex min-w-0 flex-col gap-s-2">
      <span id={labelId} className="text-label font-semibold text-ink-2">
        {label}
      </span>
      <RadioGroup
        value={value}
        onValueChange={(next) => {
          const chosen = choices.find((choice) => choice.value === next);
          if (chosen !== undefined) onChange(chosen.value);
        }}
        aria-labelledby={labelId}
      >
        {choices.map((choice) => (
          <div key={choice.value} className="flex items-center gap-s-1">
            <RadioGroupItem value={choice.value} id={`insert-${group}-${choice.value}`} />
            <Label htmlFor={`insert-${group}-${choice.value}`} className="text-body font-normal text-ink">
              {choice.text}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
