import { z } from 'zod';

import { PRICE_MESSAGE, PRICE_PATTERN, validateReason } from '../../../lib/estimate/approve-price';
import { CALCULATE_MESSAGE, CALCULATE_PREPARED_STATUS } from '../../../lib/estimate/calculate-words';
import { ESTIMATE_STATUSES } from '../../../lib/estimate/state-machine';
import { CALCULATE_ACK_REQUIRED_CODE, QTY_ZERO_CODE } from '../../../lib/estimate/warning-copy';

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

const customerChoiceSchema = z.strictObject({ id: z.string().min(1), name: z.string().min(1), shortName: z.string().min(1) });

/** The estimate and the customer it is now for. */
export const estimateCustomerSchema = z.strictObject({
  id: z.string().min(1),
  status: z.enum(ESTIMATE_STATUSES),
  customer: customerChoiceSchema,
});

/**
 * The whole answer of `POST /api/v1/estimates/{id}/calculate` (STORY-05.09 AC-2, AC-6; architecture section 6 "Calculate"; NFR-002): the status the estimate now has and the one fixed sentence,
 * and nothing else, with or without anything sent. Both values are literals, so even a handler that put a figure in either would fail the parse and answer 500 with fixed words: the schema
 * is the last guard of "the Engineer never receives a cost", behind the service (which returns exactly this) and the import rule (which keeps the Restricted tables out of its reach).
 */
export const calculateAnswerSchema = z.strictObject({
  status: z.literal(CALCULATE_PREPARED_STATUS),
  message: z.literal(CALCULATE_MESSAGE),
});

/** The largest `inputs_revision` (a PostgreSQL `integer`): an acknowledgement names a count that can exist. */
const MAX_REVISION = 2_147_483_647;

/**
 * The body of `POST /api/v1/estimates/{id}/calculate` (STORY-05.12 AC-3, AC-5; architecture sections 4.3 and 6 "Calculate"): none, or `{}`, or `{acknowledge: {inputsRevision}}` with the number from the
 * 409 `CALCULATE_ACK_REQUIRED`. Strict at both levels, and `acknowledge: true`, a string, a missing number, a negative or a fractional one is **not** this shape: the route answers 400 for it (`badBodyIs400`),
 * and a plain flag is refused on purpose, because a retry or a stale tab could pass a warning nobody saw. Whether the number is the current revision is the service's to say, under the lock.
 */
export const calculateBodySchema = z
  .strictObject({ acknowledge: z.strictObject({ inputsRevision: z.number().int().min(0).max(MAX_REVISION) }).optional() })
  .optional();

/**
 * `POST /api/v1/estimates/{id}/approve` (STORY-06.05; architecture section 6 "Approve"): the calculation the Lead was looking at, the price and, optionally, the reason for a price that differs. Strict, so a key that
 * is not named is refused. `calculationId` is compared with the estimate's current calculation under the lock (409 if it is not), which is how a figure that changed under the Lead cannot be approved.
 */
export const approveBodySchema = z.strictObject({
  calculationId: z.uuid(),
  price: z.string().regex(PRICE_PATTERN, PRICE_MESSAGE),
  // The reason for a different price (STORY-06.07 AC-4): the one rule of the dialog, so the sentence is the same on both sides. It is checked whatever the price is; whether it is kept depends on the
  // price differing from BL, which only the service can know (it reads BL itself), so a reason sent with the calculated total is ignored there (AC-5).
  reason: z
    .string()
    .superRefine((text, context) => {
      const check = validateReason(text);
      if (!check.ok) context.addIssue({ code: 'custom', message: check.message });
    })
    .optional(),
});

/**
 * The answer of a good `POST /api/v1/estimates/{id}/approve` (STORY-06.06 AC-2; NFR-002): the new status, the price as it was stored (rupees with two decimals) and when, as UTC text. A strict schema, so
 * nothing else can leave: no calculated figure, no master value, rate or formula, and no ID. The price is the one the Lead typed and the screen already shows it as BO.
 */
export const approveAnswerSchema = z.strictObject({
  status: z.literal('APPROVED'),
  approvedPrice: z.string().regex(/^\d{1,12}\.\d{2}$/),
  approvedAt: z.iso.datetime(),
});
export type ApproveAnswer = z.infer<typeof approveAnswerSchema>;

/**
 * Who marked the estimate as quoted and when (CR-01 item 7C, AQP-400; architecture section 4.12 c): a time as UTC text and the person's name now. **It exists only in the Lead and Admin schemas** (ADR-008):
 * the Engineer's schemas carry the status word Quoted and no key for this, and `tests/security/quoted-restricted.test.ts` holds both. It holds no price, no figure and no ID (NFR-002).
 */
export const quotedMarkerSchema = z.strictObject({
  at: z.iso.datetime(),
  byName: z.string().min(1),
});
export type QuotedMarkerView = z.infer<typeof quotedMarkerSchema>;

/**
 * The answer of a good `POST /api/v1/estimates/{id}/quoted` (architecture section 4.12 c, "the estimate status view"): the new status, which is the one word QUOTED, and the marker just written. A strict
 * schema, so nothing else can leave: no figure, no master value and no ID.
 */
export const markQuotedAnswerSchema = z.strictObject({
  status: z.literal('QUOTED'),
  quoted: quotedMarkerSchema,
});
export type MarkQuotedAnswer = z.infer<typeof markQuotedAnswerSchema>;

/**
 * Who ignored the estimate, when, and the remarks they gave (CR-01 item 7D, AQP-401 AC-9; architecture section 4.12 c): a time as UTC text, the person's name now and the Lead's words. **One nested object, the same
 * for every role** (ADR-008): an Engineer's own ignored task reads its notice from it, and another Engineer's task is not found before it is read. It holds no price, no figure and no ID (NFR-002): the person's ID
 * stays on the server.
 */
export const ignoredMarkerSchema = z.strictObject({
  at: z.iso.datetime(),
  byName: z.string().min(1),
  remarks: z.string().min(1),
});
export type IgnoredMarkerView = z.infer<typeof ignoredMarkerSchema>;

/** The size of the body of Ignore: only a bound, the rule (1 to 500 code points once trimmed) and its words are the service's (`checkIgnoreRemarks`), as `unlockBodySchema` does. */
const MAX_BODY_REMARKS_LENGTH = 5_000;

/** `POST /api/v1/estimates/{id}/ignore`: the Lead's remarks. A key that is left out is read as empty, and the service names it (422 under `remarks`). */
export const ignoreBodySchema = z.strictObject({ remarks: z.string().max(MAX_BODY_REMARKS_LENGTH).default('') });

/** The status that can lie under the Ignored layer: a Quoted estimate cannot be ignored. */
const IGNORABLE_STATUSES = ['DRAFT', 'PREPARED', 'APPROVED'] as const;

/** The answer of a good `POST /api/v1/estimates/{id}/ignore`: the status underneath (unchanged) and the layer just written. A strict schema, so nothing else can leave. */
export const ignoreAnswerSchema = z.strictObject({
  status: z.enum(IGNORABLE_STATUSES),
  ignored: ignoredMarkerSchema,
});
export type IgnoreAnswer = z.infer<typeof ignoreAnswerSchema>;

/** The answer of a good `POST /api/v1/estimates/{id}/restore` (no body): the status the estimate has again, the one it had when it was ignored. */
export const restoreAnswerSchema = z.strictObject({ status: z.enum(IGNORABLE_STATUSES) });
export type RestoreAnswer = z.infer<typeof restoreAnswerSchema>;

/**
 * The 409 `CALCULATE_ACK_REQUIRED` (STORY-05.12 AC-2, AC-7; architecture section 6 "Error model"; NFR-002): one strict schema, the same keys for every role and no number but `inputsRevision`
 * (a count of changes) and the Sl. No. Text and one revision: nothing that comes from a master, a rate or a calculation has a key to sit in. The wrapper builds this body in `problem.ts`, key by key;
 * this schema is what the tests and the canary scan hold it to.
 */
export const calculateAckRequiredSchema = z.strictObject({
  type: z.literal('about:blank'),
  title: z.string().min(1),
  status: z.literal(409),
  code: z.literal(CALCULATE_ACK_REQUIRED_CODE),
  requestId: z.string().min(1),
  inputsRevision: z.number().int().min(0).max(MAX_REVISION),
  warnings: z
    .array(
      z.strictObject({
        code: z.literal(QTY_ZERO_CODE),
        nodeId: z.string().min(1),
        fieldId: z.string().min(1),
        slNo: z.string().min(1),
        label: z.string(),
        message: z.string().min(1),
      }),
    )
    .min(1),
});
