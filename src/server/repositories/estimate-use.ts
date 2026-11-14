import { z } from 'zod';

import type { EstimateUse } from '../../lib/errors';

/**
 * What the delete guard of a customer and of a material (STORY-02.07; architecture section 6, "409 with the open estimates using it") reads of the estimates that
 * use one, shared by `customer-repository.ts` and `material-repository.ts` so neither imports the other.
 *
 * An estimate is **open** while it is a Draft or Submitted (BR-053). An Approved estimate is not: it is a copy already (FR-065, NFR-026), so its customer or
 * material may be deleted and it still shows and exports its own words and figures. Only the task's code and the estimate's status are read, never a figure.
 */

/** How many estimates the refusal names. The rest are only counted ("and N more", AC-2). */
export const ESTIMATE_USE_LIMIT = 10;

/** The estimates that use a customer or a material: how many there are in all, and the first `ESTIMATE_USE_LIMIT` of them in the order of their task code. */
export interface EstimateUses {
  readonly total: number;
  readonly estimates: ReadonlyArray<EstimateUse>;
}

/** The rows of the guard's query: each carries the total, which is counted over every open estimate before the limit applies. */
const ESTIMATE_USE_ROWS = z.array(z.strictObject({ code: z.string(), status: z.enum(['DRAFT', 'SUBMITTED']), total: z.number().int().positive() }));

/** The guard's rows as `EstimateUses`. No row means no open estimate: a total of 0. */
export function toEstimateUses(rows: unknown): EstimateUses {
  const parsed = ESTIMATE_USE_ROWS.parse(rows);
  return { total: parsed[0]?.total ?? 0, estimates: parsed.map(({ code, status }) => ({ code, status })) };
}
