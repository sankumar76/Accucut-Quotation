import type { ChangeEvent } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Input } from '@/components/ui/input';
import { CUSTOMER_FIELD_NAMES, type CustomerFieldName, type CustomerValues } from '@/lib/masters/customers';

import { FIELD_LABELS } from './customer-texts';

/**
 * The four fields of a customer's details (STORY-02.02 AC-1; SCR-12 "Details"): the name, which is required, and the phone, e-mail address and address,
 * which are not. The Add customer dialog and the edit page both draw them, so the labels, the ids and the input kinds are written once. It holds no state:
 * the screen owns the values and the messages, and a message is shown under its own field with the icon and the words.
 */

/** The element id of each field: unique on the page, so a label and a message are tied to their own control, and focus can be put on the first message. */
export const CUSTOMER_FIELD_IDS: Readonly<Record<CustomerFieldName, string>> = {
  name: 'customer-name',
  phone: 'customer-phone',
  email: 'customer-email',
  address: 'customer-address',
};

/** How each field is typed: the keyboard a phone offers, and the browser's address-book help turned off (the Admin types other people's details). */
const INPUT_KINDS: Readonly<Record<CustomerFieldName, { readonly type?: 'email' | 'tel'; readonly inputMode?: 'email' | 'tel' }>> = {
  name: {},
  phone: { type: 'tel', inputMode: 'tel' },
  email: { type: 'email', inputMode: 'email' },
  address: {},
};

export interface CustomerDetailsFieldsProps {
  readonly values: CustomerValues;
  /** Messages by field name; fields without one have none. */
  readonly errors: Readonly<Partial<Record<string, string>>>;
  readonly onChange: (field: CustomerFieldName, value: string) => void;
}

export function CustomerDetailsFields({ values, errors, onChange }: CustomerDetailsFieldsProps) {
  return (
    <>
      {CUSTOMER_FIELD_NAMES.map((field) => {
        const error = errors[field];
        return (
          <div key={field} className={field === 'address' ? 'md:col-span-2' : undefined}>
            <FormField id={CUSTOMER_FIELD_IDS[field]} label={FIELD_LABELS[field]} {...(error === undefined ? {} : { error })}>
              {(control) => (
                <Input
                  {...control}
                  {...INPUT_KINDS[field]}
                  name={field}
                  autoComplete="off"
                  required={field === 'name'}
                  value={values[field]}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(field, event.target.value)}
                />
              )}
            </FormField>
          </div>
        );
      })}
    </>
  );
}
