import type { ChangeEvent } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import type { AssignErrors, EngineerOption } from '@/lib/tasks/assign';

import { ASSIGN_FIELD_IDS, ASSIGN_TIME_ADDON_ID, ASSIGN_TIME_ID, type AssignFormValues, type AssignValueKey } from './assign-form-model';
import {
  ENGINEER_PLACEHOLDER,
  FIELD_LABELS,
  FOLDER_PATH_HINT,
  IST_ADDON,
  NO_ENGINEERS_HINT,
  NOTES_HINT,
  OPTIONAL_TAG,
  TIME_HINT,
  TITLE_HINT,
} from './assign-texts';

/**
 * The five fields of SCR-04 (STORY-04.01 AC-1, AC-3, AC-7): the Engineer, the network folder path, the deadline as a date and a time in IST, and the optional
 * title and notes. It holds no state: the screen owns the values and the messages, and a message is shown under its own field with the icon and the words
 * (`FormField`). The date and the time have visible labels, and "IST" is read with the time field: the add-on is part of its description.
 */

export interface AssignFieldsProps {
  readonly values: AssignFormValues;
  readonly errors: AssignErrors;
  readonly engineers: ReadonlyArray<EngineerOption>;
  readonly onChange: (key: AssignValueKey, value: string) => void;
}

/** `{ error }` for a field that has a message, and nothing for one that has none (the props are exact: an `undefined` message is not allowed). */
const errorOf = (message: string | undefined): { readonly error?: string } => (message === undefined ? {} : { error: message });

const optionalTag = <span className="font-normal text-ink-3">{` ${OPTIONAL_TAG}`}</span>;

function EngineerField({ values, errors, engineers, onChange }: AssignFieldsProps) {
  return (
    <FormField
      id={ASSIGN_FIELD_IDS.engineerId}
      label={FIELD_LABELS.engineerId}
      {...(engineers.length === 0 ? { hint: NO_ENGINEERS_HINT } : {})}
      {...errorOf(errors.engineerId)}
    >
      {(control) => (
        <NativeSelect {...control} name="engineerId" required value={values.engineerId} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange('engineerId', event.target.value)}>
          <option value="">{ENGINEER_PLACEHOLDER}</option>
          {engineers.map((engineer) => (
            <option key={engineer.id} value={engineer.id}>
              {engineer.name}
            </option>
          ))}
        </NativeSelect>
      )}
    </FormField>
  );
}

function PathField({ values, errors, onChange }: AssignFieldsProps) {
  return (
    <FormField id={ASSIGN_FIELD_IDS.folderPath} label={FIELD_LABELS.folderPath} hint={FOLDER_PATH_HINT} {...errorOf(errors.folderPath)}>
      {(control) => (
        <Input
          {...control}
          name="folderPath"
          required
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          value={values.folderPath}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange('folderPath', event.target.value)}
        />
      )}
    </FormField>
  );
}

function DeadlineFields({ values, errors, onChange }: AssignFieldsProps) {
  const error = errors.deadline;
  return (
    <div className="grid gap-s-4 sm:grid-cols-2">
      <FormField id={ASSIGN_FIELD_IDS.deadline} label={FIELD_LABELS.deadline} {...errorOf(error)}>
        {(control) => (
          <Input {...control} name="deadlineDate" type="date" required value={values.deadlineDate} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange('deadlineDate', event.target.value)} />
        )}
      </FormField>
      <FormField id={ASSIGN_TIME_ID} label={FIELD_LABELS.deadlineTime} hint={TIME_HINT}>
        {(control) => (
          <div className="flex items-stretch">
            <Input
              {...control}
              // "IST" is read with the field, then the hint ("India Standard Time (UTC+5:30)."): both are its description.
              aria-describedby={[ASSIGN_TIME_ADDON_ID, control['aria-describedby']].filter((part) => part !== undefined).join(' ')}
              aria-invalid={error === undefined ? undefined : true}
              name="deadlineTime"
              type="time"
              required
              className="rounded-r-none"
              value={values.deadlineTime}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onChange('deadlineTime', event.target.value)}
            />
            <span id={ASSIGN_TIME_ADDON_ID} className="flex items-center rounded-r-md border border-l-0 border-border-strong bg-surface-2 px-s-3 text-body font-semibold text-ink-2">
              {IST_ADDON}
            </span>
          </div>
        )}
      </FormField>
    </div>
  );
}

function TextFields({ values, errors, onChange }: AssignFieldsProps) {
  return (
    <>
      <FormField id={ASSIGN_FIELD_IDS.title} label={FIELD_LABELS.title} tag={optionalTag} hint={TITLE_HINT} {...errorOf(errors.title)}>
        {(control) => <Input {...control} name="title" autoComplete="off" value={values.title} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange('title', event.target.value)} />}
      </FormField>
      <FormField id={ASSIGN_FIELD_IDS.notes} label={FIELD_LABELS.notes} tag={optionalTag} hint={NOTES_HINT} {...errorOf(errors.notes)}>
        {(control) => <Textarea {...control} name="notes" value={values.notes} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange('notes', event.target.value)} />}
      </FormField>
    </>
  );
}

export function AssignFields(props: AssignFieldsProps) {
  return (
    <>
      <EngineerField {...props} />
      <PathField {...props} />
      <DeadlineFields {...props} />
      <TextFields {...props} />
    </>
  );
}
