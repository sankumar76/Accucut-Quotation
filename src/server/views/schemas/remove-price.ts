import { z } from 'zod';

import { stepUpPasswordSchema } from './step-up';

/**
 * The contract of the Remove price route (STORY-06.13; architecture section 6 "Remove price"; NFR-002): Admin only, so nothing an Engineer may call has a schema like this. The body and the answer are strict
 * objects, so a key that is not named is an error and never reaches a client. **Restricted** (ADR-008): the answer holds a time and nothing else: **no price** (AC-6), no figure, no ID and **never the password**.
 */

/**
 * `POST /api/v1/estimates/{id}/approval/remove-price`: the approval the Admin saw (`approvalId`, the cancelled one) and their password (`password`, STORY-06.14: presence and the ceiling only; it is never trimmed,
 * echoed or stored). There is no reason: the audit entry keeps the price, who and when.
 */
export const removePriceBodySchema = z.strictObject({
  approvalId: z.uuid(),
  password: stepUpPasswordSchema,
});

/** The whole answer of a good removal: when (UTC text). The page is drawn again by the server, so nothing else is needed, and the price is not here. */
export const removePriceAnswerSchema = z.strictObject({
  removedAt: z.iso.datetime(),
});
export type RemovePriceAnswer = z.infer<typeof removePriceAnswerSchema>;
