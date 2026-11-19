import { z } from 'zod';

import { stepUpPasswordSchema } from './step-up';

/**
 * The contract of the Cancel approval route (STORY-06.12; architecture section 6 "Cancel approval"; NFR-002): Admin only, so nothing an Engineer may call has a schema like this. The body and the answer are strict
 * objects, so a key that is not named is an error and never reaches a client. **Restricted** (ADR-008): the answer holds the status and a time; it holds no price, no figure, no ID and **never the password**.
 */

/** The most characters the body may carry for the reason. Only a bound on the size: the rule (1 to 500 characters once trimmed) and its words are the service's (`checkCancelReason`). */
const MAX_BODY_REASON_LENGTH = 5_000;

/**
 * `POST /api/v1/estimates/{id}/approval/cancel`: the approval the Admin saw (`approvalId`), their reason and their password (`password`, STORY-06.14: presence and the ceiling only; it is never trimmed, echoed or
 * stored). A reason that is left out is read as empty, and the service names it (422 under `reason`).
 */
export const cancelApprovalBodySchema = z.strictObject({
  approvalId: z.uuid(),
  reason: z.string().max(MAX_BODY_REASON_LENGTH).default(''),
  password: stepUpPasswordSchema,
});

/** The whole answer of a good cancel: the status the estimate has now (DRAFT, or the DRAFT or SUBMITTED it already had) and when (UTC text). */
export const cancelApprovalAnswerSchema = z.strictObject({
  status: z.enum(['DRAFT', 'SUBMITTED']),
  cancelledAt: z.iso.datetime(),
});
export type CancelApprovalAnswer = z.infer<typeof cancelApprovalAnswerSchema>;
