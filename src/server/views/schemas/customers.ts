import { z } from 'zod';

import {
  addressProblem,
  canonicalCustomerName,
  CUSTOMER_NAME_MAX_LENGTH,
  CUSTOMER_NAME_REQUIRED_MESSAGE,
  emailProblem,
  NOTHING_TO_CHANGE_CUSTOMER_MESSAGE,
  phoneProblem,
} from '../../../lib/masters/customers';
import { DECIMAL_TEXT_MESSAGE, DECIMAL_TEXT_PATTERN, NAME_TOO_LONG_MESSAGE } from '../../../lib/masters/master-rules';

/**
 * The contract of the Customer routes (STORY-02.02, architecture section 6 "Customers" and "Reset customer"). Every body, path parameter and answer is
 * a strict object: a key that is not named is an error, so nothing is sent that is not meant to be, and a client cannot set a field the route does not
 * offer (NFR-002). The limits and the messages are the ones the screen uses (`src/lib/masters/customers.ts`) and are shown under the field they name.
 * Whether a name is free, and whether a typed rate belongs to the customer (the item is the service's to look up), are the
 * service's: a schema cannot see the other customers or the Process Master.
 *
 * These are the Admin's schemas, and they carry the contact details and the rates. The estimate form's list is `schemas/options.ts`, which carries an
 * ID and a name and nothing else.
 */

/** The name in its stored (canonical) form, and the limits are checked on that form, as the screen and the service check them (QLT-04): one rule in one place. */
const name = z
  .string({ error: CUSTOMER_NAME_REQUIRED_MESSAGE })
  .transform(canonicalCustomerName)
  .pipe(z.string().min(1, CUSTOMER_NAME_REQUIRED_MESSAGE).max(CUSTOMER_NAME_MAX_LENGTH, NAME_TOO_LONG_MESSAGE));

/** A check of the screen's (`phoneProblem`, `emailProblem`, `addressProblem`) as a zod refinement, so the schema and the form say the same words. */
function contactField(problemOf: (value: string) => string | null) {
  return z
    .string()
    .superRefine((value, context) => {
      const problem = problemOf(value);
      if (problem !== null) context.addIssue({ code: 'custom', message: problem });
    })
    .nullable();
}

const phone = contactField(phoneProblem);
const email = contactField(emailProblem);
const address = contactField(addressProblem);

/** A rate to set (AC-2): the Process Master item and the value as decimal text, never a JSON number (coding standards section 10). */
const rateChange = z.strictObject({
  processItemId: z.uuid('Not a rate ID.').transform((id) => id.toLowerCase()),
  value: z.string({ error: DECIMAL_TEXT_MESSAGE }).trim().regex(DECIMAL_TEXT_PATTERN, DECIMAL_TEXT_MESSAGE),
});

/** At most as many rates as there are Process Master items could ever be sent; 200 is far above that and keeps a body small. */
const MAX_RATES_PER_REQUEST = 200;

const rates = z
  .array(rateChange)
  .max(MAX_RATES_PER_REQUEST)
  .refine((list) => new Set(list.map((entry) => entry.processItemId)).size === list.length, { message: 'Each rate can be set once.' });

const rateRow = z.strictObject({
  processItemId: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1),
  defaultValue: z.string().min(1),
  value: z.string().min(1),
});

/** A row of SCR-12's list: the details and how many of the customer's rates differ from the defaults. */
export const customerSummarySchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  differ: z.number().int().nonnegative(),
});

export const customersResponseSchema = z.strictObject({ customers: z.array(customerSummarySchema).readonly() });

/** A customer with every rate beside its default: SCR-12's edit page. */
export const customerSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  rates: z.array(rateRow).readonly(),
});

/** `POST /api/v1/customers/{id}/reset-rates` (AC-3): the customer as it is now, and how many rates were replaced. */
export const resetCustomerResponseSchema = z.strictObject({ customer: customerSchema, count: z.number().int().nonnegative() });

/** `POST /api/v1/customers` (AC-1): the name is required; a contact field may be left out or null. */
export const createCustomerBodySchema = z.strictObject({ name, phone: phone.optional(), email: email.optional(), address: address.optional() });

/** `PATCH /api/v1/customers/{id}` (AC-2): any of the details and the rates to set; at least one field. */
export const updateCustomerBodySchema = z
  .strictObject({ name, phone, email, address, rates })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: NOTHING_TO_CHANGE_CUSTOMER_MESSAGE });

/**
 * The path parameter of `/api/v1/customers/{id}`: a UUID, or the request is refused as invalid before anything is looked up. It is written in lower
 * case, the way PostgreSQL returns an ID.
 */
export const customerIdParamsSchema = z.strictObject({ id: z.uuid('Not a customer ID.').transform((id) => id.toLowerCase()) });
