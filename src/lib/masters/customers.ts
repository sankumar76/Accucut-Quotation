import { DECIMAL_TEXT_MESSAGE, DECIMAL_TEXT_PATTERN, MASTER_NAME_MAX_LENGTH, NAME_TOO_LONG_MESSAGE, normaliseDecimalText } from './master-rules';

/**
 * What the Customers screens (SCR-12) and their routes share (STORY-02.02; SPEC section 4.2, architecture sections 5.1 and 6): the limits, the
 * words, and the checks of a typed field and of a typed rate. Pure and without zod, so the page does not carry them (NFR-009) and a client
 * component may import it. The server states the same rules again in `src/server/views/schemas/customers.ts`, which imports the limits and the
 * words from here, so a limit or a sentence is written once.
 *
 * Only the name is required (OQ-UX-04). The limits of the three contact fields are the build's own, because neither the architecture nor the
 * ux-spec gives one: they keep a pasted block of text out of a column, and are generous for a real phone number, address or e-mail address.
 */

/** The longest customer name. The same limit as every master's name (`master-rules.ts`). */
export const CUSTOMER_NAME_MAX_LENGTH = MASTER_NAME_MAX_LENGTH;
export const PHONE_MAX_LENGTH = 30;
/** The longest e-mail address there can be (RFC 5321: 254 characters). */
export const EMAIL_MAX_LENGTH = 254;
export const ADDRESS_MAX_LENGTH = 300;

/** AC-1: the words of the refusals, as the ux-spec SCR-12 gives them. */
export const CUSTOMER_NAME_REQUIRED_MESSAGE = 'Enter the customer name.';
export const CUSTOMER_NAME_TAKEN_MESSAGE = 'A customer with this name already exists.';
export const EMAIL_FORMAT_MESSAGE = 'Enter an e-mail address like name@company.com.';
export const NOTHING_TO_CHANGE_CUSTOMER_MESSAGE = 'Change at least one of the details or a rate.';


export const tooLongMessage = (limit: number): string => `Use ${limit} characters or fewer.`;

/** The fields of the Details card, in the order the form draws them, so focus goes to the first one with a message. */
export const CUSTOMER_FIELD_NAMES = ['name', 'phone', 'email', 'address'] as const;
export type CustomerFieldName = (typeof CUSTOMER_FIELD_NAMES)[number];

/** The three contact fields: the audit entry names the ones that changed, never what they hold (architecture section 8). */
export const CONTACT_FIELD_NAMES = ['phone', 'email', 'address'] as const;
export type ContactFieldName = (typeof CONTACT_FIELD_NAMES)[number];

/** The Details card as the form holds it: text, with an empty string for a contact field that is not given. */
export type CustomerValues = { readonly [Field in CustomerFieldName]: string };

export type CustomerErrors = Readonly<Partial<Record<CustomerFieldName, string>>>;

/** A customer's details as stored: a contact field that is not given is `null`. */
export interface CustomerDetails {
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
}

/** The part of the details a request asks to set. A contact field given as `null` is cleared. */
export interface CustomerFields {
  readonly name?: string | undefined;
  readonly phone?: string | null | undefined;
  readonly email?: string | null | undefined;
  readonly address?: string | null | undefined;
}

/** The one form in which a name is stored and compared: compatibility forms folded, surrounding spaces removed, runs of spaces made one. */
export function canonicalCustomerName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

/** The stored form of a contact field: surrounding spaces removed, and `null` when nothing is left. */
export function contactValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/** The message under the name field, or `null`: required, and at most 100 characters in the stored (canonical) form (AC-1). */
export function customerNameProblem(value: string): string | null {
  const trimmed = canonicalCustomerName(value);
  if (trimmed === '') return CUSTOMER_NAME_REQUIRED_MESSAGE;
  return trimmed.length > CUSTOMER_NAME_MAX_LENGTH ? NAME_TOO_LONG_MESSAGE : null;
}

/** The message under the phone field, or `null`: at most 30 characters; a phone number is otherwise free text (AC-1). */
export function phoneProblem(value: string): string | null {
  return value.trim().length > PHONE_MAX_LENGTH ? tooLongMessage(PHONE_MAX_LENGTH) : null;
}

/** One `@` between two parts without spaces, and a dot in the part after it: "looks like an address", the whole of the check (AC-1). */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

/** The message under the e-mail field, or `null`: optional, at most 254 characters, and it must look like an address (AC-1). */
export function emailProblem(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed.length > EMAIL_MAX_LENGTH) return tooLongMessage(EMAIL_MAX_LENGTH);
  return EMAIL_PATTERN.test(trimmed) ? null : EMAIL_FORMAT_MESSAGE;
}

/** The message under the address field, or `null`: optional, at most 300 characters (AC-1). */
export function addressProblem(value: string): string | null {
  return value.trim().length > ADDRESS_MAX_LENGTH ? tooLongMessage(ADDRESS_MAX_LENGTH) : null;
}

const FIELD_CHECKS: Readonly<Record<CustomerFieldName, (value: string) => string | null>> = {
  name: customerNameProblem,
  phone: phoneProblem,
  email: emailProblem,
  address: addressProblem,
};

/** The message for one field of the Details card, or null. */
export function customerFieldProblem(field: CustomerFieldName, value: string): string | null {
  return FIELD_CHECKS[field](value);
}

/** The messages under the fields of the Details card, or none. Only the shape is checked here; whether a name is free is the server's. */
export function customerFormProblems(values: CustomerValues): CustomerErrors {
  const found: { -readonly [Field in CustomerFieldName]?: string } = {};
  for (const field of CUSTOMER_FIELD_NAMES) {
    const problem = customerFieldProblem(field, values[field]);
    if (problem !== null) found[field] = problem;
  }
  return found;
}

/** The Details card of a new customer is empty; an edit starts from the customer's own details. */
export function initialCustomerValues(original: CustomerDetails | null): CustomerValues {
  return { name: original?.name ?? '', phone: original?.phone ?? '', email: original?.email ?? '', address: original?.address ?? '' };
}

/** The errors without the one for `field`, once the person has changed that field. */
export function withoutCustomerError(errors: CustomerErrors, field: CustomerFieldName): CustomerErrors {
  return Object.fromEntries(Object.entries(errors).filter(([name]) => name !== field));
}

/**
 * What really changes when `wanted` is applied to a customer's details: only a field that is given and differs (the name compared in its
 * canonical form but with letter case kept, so "acme" to "Acme" counts; a contact field compared as stored, so "" and `null` are one value).
 * An empty result changes nothing, writes no entry on the server and sends no request from the screen. The one rule of both.
 */
export function detailChangesFrom(before: CustomerDetails, wanted: CustomerFields): CustomerFields {
  const changes: { -readonly [Field in keyof CustomerFields]: CustomerFields[Field] } = {};
  if (wanted.name !== undefined && canonicalCustomerName(wanted.name) !== before.name) changes.name = canonicalCustomerName(wanted.name);
  for (const field of CONTACT_FIELD_NAMES) {
    const given = wanted[field];
    if (given !== undefined && contactValue(given) !== before[field]) changes[field] = contactValue(given);
  }
  return changes;
}

/** The names of the contact fields a set of changes touches, in the order of the form. */
export function changedContactFields(changes: CustomerFields): ReadonlyArray<ContactFieldName> {
  return CONTACT_FIELD_NAMES.filter((field) => changes[field] !== undefined);
}

/** The body of an add or an edit for what was typed: the name in its canonical form and a contact field as `null` when it is empty. */
export function customerBody(values: CustomerValues): { readonly name: string; readonly phone: string | null; readonly email: string | null; readonly address: string | null } {
  return { name: canonicalCustomerName(values.name), phone: contactValue(values.phone), email: contactValue(values.email), address: contactValue(values.address) };
}

// ---- Rates (AC-2) ------------------------------------------------------------------------------------------------------------

/** One of the customer's rates beside the Process Master's current default for it. The values are decimal text with at least two decimals. */
export interface CustomerRate {
  readonly processItemId: string;
  readonly name: string;
  readonly unit: string;
  readonly defaultValue: string;
  readonly value: string;
}

/** The message for a typed rate, or null: a number of 0 or more with up to 2 decimals, for every rate, a percent rate included (AC-2 as amended, SPEC D-24). */
export function rateProblem(value: string): string | null {
  return DECIMAL_TEXT_PATTERN.test(value.trim()) ? null : DECIMAL_TEXT_MESSAGE;
}

/** A typed rate as the stored text: no leading zeros and two decimals, so "0.5" and "00.50" are one value. Must satisfy `rateProblem` first. */
export function rateText(value: string): string {
  return normaliseDecimalText(value);
}

/** Does the customer's value differ from the Process Master's default? Both are compared as stored text, so "11" and "11.00" are one value. */
export function differsFromDefault(rate: Pick<CustomerRate, 'defaultValue' | 'value'>): boolean {
  return rateText(rate.value) !== rateText(rate.defaultValue);
}

/** How many of the rates differ from their default: the number SCR-12's list shows. */
export function differCount(rates: ReadonlyArray<Pick<CustomerRate, 'defaultValue' | 'value'>>): number {
  return rates.filter(differsFromDefault).length;
}
