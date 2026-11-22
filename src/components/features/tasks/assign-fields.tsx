import type { ChangeEvent } from 'react';

import { FormField } from '@/components/shared/form-field';
import { ReadOnlyField } from '@/components/shared/read-only-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import type { AssignErrors, CustomerOption, EngineerOption } from '@/lib/tasks/assign';

import { ASSIGN_FIELD_IDS, ASSIGN_SHORT_NAME_ID, ASSIGN_TIME_ADDON_ID, ASSIGN_TIME_ID, type AssignFormValues, type AssignValueKey } from './assign-form-model';
import {
  CUSTOMER_HINT,
  CUSTOMER_PLACEHOLDER,
  ENGINEER_PLACEHOLDER,
  FIELD_LABELS,
  FOLDER_PATH_HINT,
  IST_ADDON,
  NO_CUSTOMERS_HINT,
  NO_ENGINEERS_HINT,
  NOTES_HINT,
  OPTIONAL_TAG,
  SHORT_NAME_HINT,
  SHORT_NAME_LABEL,
  SUBJECT_HINT,
  TIME_HINT,
  TITLE_HINT,
} from './assign-texts';

/**
 * The fields of SCR-04 (STORY-04.01 AC-1, AC-3, AC-7; CR-01 item 6, AQP-390): the Engineer, the customer with its short name (read-only, filled from the master), the network folder path, the deadline as a
 * date and a time in IST, the title and the subject (both required) and the optional notes. It holds no state: the screen owns the values and the messages, and a message is shown under its own field with the icon and the words
 * (`FormField`). The date and the time have visible labels, and "IST" is read with the time field: the add-on is part of its description.
 */

/** What the fields that Assign and Reassign share need: the values, the messages, the Engineers and the change handler. */
export interface SharedFieldsProps {
  readonly values: AssignFormValues;
  readonly errors: AssignErrors;
  readonly engineers: ReadonlyArray<EngineerOption>;
  readonly onChange: (key: AssignValueKey, value: string) => void;
}

/** Assign task also draws the customer, so it also needs the customers (CR-01 item 6). Reassign does not change the customer. */
export interface AssignFieldsProps extends SharedFieldsProps {
  readonly customers: ReadonlyArray<CustomerOption>;
}

/** `{ error }` for a field that has a message, and nothing for one that has none (the props are exact: an `undefined` message is not allowed). */
const errorOf = (message: string | undefined): { readonly error?: string } => (message === undefined ? {} : { error: message });

const optionalTag = <span className="font-normal text-ink-3">{` ${OPTIONAL_TAG}`}</span>;

export function EngineerField({ values, errors, engineers, onChange }: SharedFieldsProps) {
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

/** "Customer Name" (a select of the customers that are not deleted, by name) and the "Customer Short Name" output under it, which updates at once with the choice and is empty before one. */
export function CustomerFields({ values, errors, customers, onChange }: AssignFieldsProps) {
  const chosen = customers.find((customer) => customer.id === values.customerId);
  return (
    <>
      <FormField id={ASSIGN_FIELD_IDS.customerId} label={FIELD_LABELS.customerId} hint={customers.length === 0 ? NO_CUSTOMERS_HINT : CUSTOMER_HINT} {...errorOf(errors.customerId)}>
        {(control) => (
          <NativeSelect {...control} name="customerId" required value={values.customerId} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange('customerId', event.target.value)}>
            <option value="">{CUSTOMER_PLACEHOLDER}</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <ReadOnlyField id={ASSIGN_SHORT_NAME_ID} label={SHORT_NAME_LABEL} hint={SHORT_NAME_HINT} mono>
        {chosen === undefined ? '' : chosen.shortName}
      </ReadOnlyField>
    </>
  );
}

function PathField({ values, errors, onChange }: SharedFieldsProps) {
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

export function DeadlineFields({ values, errors, onChange }: SharedFieldsProps) {
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

function TextFields({ values, errors, onChange }: SharedFieldsProps) {
  return (
    <>
      <FormField id={ASSIGN_FIELD_IDS.title} label={FIELD_LABELS.title} hint={TITLE_HINT} {...errorOf(errors.title)}>
        {(control) => <Input {...control} name="title" required autoComplete="off" value={values.title} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange('title', event.target.value)} />}
      </FormField>
      <FormField id={ASSIGN_FIELD_IDS.subject} label={FIELD_LABELS.subject} hint={SUBJECT_HINT} {...errorOf(errors.subject)}>
        {(control) => <Input {...control} name="subject" required autoComplete="off" value={values.subject} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange('subject', event.target.value)} />}
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
      <CustomerFields {...props} />
      <PathField {...props} />
      <DeadlineFields {...props} />
      <TextFields {...props} />
    </>
  );
}
