import { assertNever } from '../assert-never';
import type { RoleName } from '../auth/roles';

import { decideTransition, isLocked, type EstimateState } from './state-machine';

/**
 * Whether this role may change the inputs of an estimate in this state (STORY-06.01 AC-2; FR-064, BR-012; CR-01 item 7B). A DRAFT may be changed by whoever has it open
 * (whose task it is, the service decides); a PREPARED estimate only by a Lead or an Admin, which is the `EDIT` event of the state machine, so the Engineer's
 * inputs are read-only from the first calculation on; a locked one (`isLocked`: APPROVED or QUOTED) by nobody; and an **ignored** one by nobody, whatever its status underneath
 * (DL-300 (1): the tree and the inputs are read-only until the estimate is restored). Pure code: the UI reads it to show inputs read-only and to hide the part
 * actions, and the server asks it again, after the estimate is locked, before every write of an input (a field, a part, an image, the customer).
 */
export function canEditInputs(input: EstimateState, role: RoleName): boolean {
  if (input.ignored) return false;
  if (isLocked(input.status)) return false;
  switch (input.status) {
    case 'DRAFT':
      return true;
    case 'PREPARED':
      return decideTransition(input, 'EDIT', role).allowed;
    default:
      return assertNever(input.status, 'estimate status');
  }
}
