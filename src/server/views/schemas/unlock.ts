import { z } from 'zod';

/**
 * The contract of the unlock routes (STORY-06.08; architecture section 6 "Unlock preview" and "Unlock"; NFR-002): Lead and Admin only, so nothing an Engineer may call has a schema like these. Every body and answer is a
 * strict object, so a key that is not named is an error and never reaches a client. **Restricted** (ADR-008): the preview speaks of rates and prices, so it answers counts by kind and two version numbers and nothing
 * else: no rate, no price, no name, no old value and no new value.
 */

/** The most characters the body may carry for the reason. Only a bound on the size: the rule (1 to 500 characters once trimmed) and its words are the service's (`checkUnlockReason`). */
const MAX_BODY_REASON_LENGTH = 5_000;

/** `POST /api/v1/estimates/{id}/unlock`: the Lead's reason. A reason that is left out is read as empty, and the service names it (422 under `reason`). */
export const unlockBodySchema = z.strictObject({ reason: z.string().max(MAX_BODY_REASON_LENGTH).default('') });

/** The whole answer of a good unlock: the new status and when (UTC text). Both are fixed in shape, so no calculated figure or master value has a key to sit in. */
export const unlockAnswerSchema = z.strictObject({
  status: z.literal('DRAFT'),
  unlockedAt: z.iso.datetime(),
});
export type UnlockAnswer = z.infer<typeof unlockAnswerSchema>;

const count = z.number().int().min(0);
const versionNumber = z.number().int().positive();

/**
 * The answer of `GET /api/v1/estimates/{id}/unlock-preview` (AC-1, AC-8): the number of the configuration version the approved calculation used and the one in force now, and how many process rates, material
 * prices and exchange rates changed since, as counts.
 */
export const unlockPreviewSchema = z.strictObject({
  /** The name now of the Engineer whose Open queue the task returns to (the dialog says so). A person's name, not a cost. */
  engineerName: z.string().min(1),
  configuration: z.strictObject({ approved: versionNumber, current: versionNumber }),
  changed: z.strictObject({ processRates: count, materialPrices: count, exchangeRates: count }),
});
export type UnlockPreviewAnswer = z.infer<typeof unlockPreviewSchema>;
