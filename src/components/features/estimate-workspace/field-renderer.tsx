import type { ChangeEvent } from 'react';

import { ColumnTag } from '@/components/shared/column-tag';
import { FormField } from '@/components/shared/form-field';
import { UnitInput } from '@/components/shared/unit-input';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import type { FormField as FormFieldView, MaterialChoice } from '@/lib/estimates/form-client';

import { MATERIAL_LOADING, MATERIAL_PLACEHOLDER } from './estimate-texts';
import type { Loaded } from './use-part-form';

/** Marks a control that Enter moves on from: the form's key handler finds the next one by this, and skips a read-only or disabled one (STORY-05.03 AC-6). */
export const FIELD_MARK = 'data-part-field';

export interface FieldRendererProps {
  readonly field: FormFieldView;
  /** The text shown: what the person typed, or what the server holds. For a derived field, the text it follows (Sl. No., Material Considered). */
  readonly text: string;
  readonly error: string | undefined;
  /** False once the estimate may no longer be changed by this person: every control is read-only. */
  readonly editable: boolean;
  readonly materials: Loaded<ReadonlyArray<MaterialChoice>>;
  readonly onChange: (text: string) => void;
  /** The person left the field, or chose from a list (then with the choice's text). */
  readonly onCommit: (override?: string) => void;
}

/** The id of a field's control: the registry's field ID, which is unique on the page. */
export const controlIdOf = (field: FormFieldView): string => `part-field-${field.id}`;

/**
 * One field of the part form (STORY-05.03 AC-1, AC-2, AC-3, AC-5): the label with its Excel column letter first ("Excel column J" is read before the name, UX spec SCR-05
 * "Accessibility"), the hint under it, the unit beside it, and the control the field's rule asks for: a number or a text box, the materials as a drop-down, or, for a field that follows
 * something else (Sl. No., Material Considered), a read-only box with the shaded look. Nothing here knows a field by its name: what it is and says comes from the server's form.
 */
export function FieldRenderer({ field, text, error, editable, materials, onChange, onCommit }: FieldRendererProps) {
  const id = controlIdOf(field);
  const readOnly = !editable || !field.editable;
  const mark = field.editable && editable ? 'true' : undefined;
  const tag = <ColumnTag letter={field.letter} kind={field.kind} />;
  const common = { name: field.id, 'data-part-field': mark };

  return (
    <FormField id={id} label={field.label} tag={tag} tagFirst {...(field.hint === null ? {} : { hint: field.hint })} {...(error === undefined ? {} : { error })}>
      {(control) => {
        const rule = field.rule;
        if (rule.type === 'select') {
          const choices = materials.status === 'ready' ? materials.value : [];
          const unlisted = text !== '' && !choices.some((choice) => choice.id === text);
          return (
            <NativeSelect
              {...control}
              {...common}
              disabled={readOnly || materials.status !== 'ready'}
              aria-busy={materials.status === 'loading' || undefined}
              value={text}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                onChange(event.target.value);
                onCommit(event.target.value);
              }}
            >
              <option value="">{materials.status === 'loading' ? MATERIAL_LOADING : MATERIAL_PLACEHOLDER}</option>
              {unlisted ? <option value={text}>{text}</option> : null}
              {choices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.name}
                </option>
              ))}
            </NativeSelect>
          );
        }
        if (rule.type === 'text' && rule.multiline) {
          return (
            <Textarea
              {...control}
              {...common}
              readOnly={readOnly}
              maxLength={rule.maxLength}
              value={text}
              onChange={(event) => onChange(event.target.value)}
              onBlur={() => onCommit()}
            />
          );
        }
        const input = {
          ...control,
          ...common,
          readOnly,
          value: text,
          autoComplete: 'off',
          enterKeyHint: 'next',
          onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
          onBlur: () => onCommit(),
        } as const;
        if (rule.type === 'number') {
          return field.unit === null ? <Input {...input} inputMode="decimal" /> : <UnitInput {...input} unit={field.unit} inputMode="decimal" />;
        }
        if (rule.type === 'text') return <Input {...input} maxLength={rule.maxLength} />;
        return <Input {...input} aria-readonly="true" />;
      }}
    </FormField>
  );
}
