import { ConflictError } from '../errors';

import type { QuantityWarning } from './quantity-warnings';
import { ACK_REQUIRED_TITLE, CALCULATE_ACK_REQUIRED_CODE } from './warning-copy';

/**
 * Calculate found rows with 0 in QTY per Assy and the person has not yet said "go ahead" for this state of the estimate (STORY-05.12 AC-2, AC-4; architecture section 4.3): 409, nothing was
 * written. The body carries the estimate's `inputsRevision`, which the acknowledgement must send back, the ID of the QTY per Assy field and the rows (code, part, Sl. No, name), and **nothing else**: no
 * master value, rate or figure is read before this is raised (NFR-002), so the same estimate gives the same body under any masters. It is raised only after the estimate was found to be the
 * person's and a draft and its inputs were complete, so it tells a stranger nothing.
 *
 * Its own file and not `errors.ts`: that file is read by modules the browser carries, and the page of the estimate has no room left in its first load (NFR-009); only the server raises and maps this.
 */
export class CalculateAckRequiredError extends ConflictError {
  constructor(
    readonly inputsRevision: number,
    readonly quantityFieldId: string,
    readonly warnings: ReadonlyArray<QuantityWarning>,
  ) {
    super(ACK_REQUIRED_TITLE, { code: CALCULATE_ACK_REQUIRED_CODE });
  }
}
