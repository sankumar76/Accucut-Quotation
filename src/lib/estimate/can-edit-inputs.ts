import { assertNever } from '../assert-never';
import type { RoleName } from '../auth/roles';

import { decideTransition, type EstimateStatus } from './state-machine';

/**
 * Whether this role may change the inputs of an estimate in this status (STORY-06.01 AC-2; FR-064, BR-012). A DRAFT may be changed by whoever has it open
 * (whose task it is, the service decides); a SUBMITTED estimate only by a Lead or an Admin, which is the `EDIT` event of the state machine, so the Engineer's
 * inputs are read-only from the first calculation on; an APPROVED one by nobody. Pure code: the UI reads it to show inputs read-only and to hide the part
 * actions, and the server asks it again, after the estimate is locked, before every write of an input (a field, a part, an image, the customer).
 */
export function canEditInputs(status: EstimateStatus, role: RoleName): boolean {
  switch (status) {
    case 'DRAFT':
      return true;
    case 'SUBMITTED':
      return decideTransition(status, 'EDIT', role).allowed;
    case 'APPROVED':
      return false;
    default:
      return assertNever(status, 'estimate status');
  }
}
