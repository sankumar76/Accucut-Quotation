import { z } from 'zod';

import { CALCULATE_MESSAGE, CALCULATE_SUBMITTED_STATUS } from '../../../lib/estimate/calculate-words';

/**
 * The contract of the estimate routes (STORY-05.01, architecture section 6 "Set customer"). Every body, path parameter and answer is a strict object: a key
 * that is not named is an error, so nothing is sent that is not meant to be, and a client cannot set a field the route does not offer. The route is open to
 * every role, an Engineer included (their own estimate, while it is a draft), so it has exactly one response schema, with **no rate, cost or formula in it**:
 * the customer is an ID and a name (NFR-002, BR-003).
 *
 * The path parameter and the body only bound the size of the text. Whether the estimate exists and is the caller's, and whether the customer exists, is the
 * estimate service's to say: an ID that is not one of them is a 404 for the estimate and a 422 under `customerId` for the customer, with the words of the
 * UX spec, and never a 400 that would tell a real ID from an invented one.
 */

const MAX_ID_LENGTH = 100;

/** The path parameter of `/api/v1/estimates/{id}`. */
export const estimateIdParamsSchema = z.strictObject({ id: z.string().max(MAX_ID_LENGTH) });

/** `PUT /api/v1/estimates/{id}/customer`: the customer chosen. A field that is left out is read as empty, and the service names it. */
export const setCustomerBodySchema = z.strictObject({ customerId: z.string().max(MAX_ID_LENGTH).default('') });

const customerChoiceSchema = z.strictObject({ id: z.string().min(1), name: z.string().min(1) });

/** The estimate and the customer it is now for. */
export const estimateCustomerSchema = z.strictObject({
  id: z.string().min(1),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED']),
  customer: customerChoiceSchema,
});

/**
 * The whole answer of `POST /api/v1/estimates/{id}/calculate` (STORY-05.09 AC-2, AC-6; architecture section 6 "Calculate"; NFR-002): the status the estimate now has and the one fixed sentence,
 * and nothing else, with or without anything sent. Both values are literals, so even a handler that put a figure in either would fail the parse and answer 500 with fixed words: the schema
 * is the last guard of "the Engineer never receives a cost", behind the service (which returns exactly this) and the import rule (which keeps the Restricted tables out of its reach).
 */
export const calculateAnswerSchema = z.strictObject({
  status: z.literal(CALCULATE_SUBMITTED_STATUS),
  message: z.literal(CALCULATE_MESSAGE),
});
