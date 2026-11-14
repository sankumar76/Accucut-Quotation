import { assertNever } from '../assert-never';
import type { RoleName } from '../auth/roles';

/**
 * The estimate state machine (STORY-06.01; FR-064; architecture section 4.4). Pure code, no I/O: it answers one question, "may this role apply this event to
 * an estimate in this status, and what status follows?", and every server rule about status asks it, so no action can run in the wrong status and no input
 * can change when it must not.
 *
 *   DRAFT      --CALCULATE (Engineer) / RECALCULATE (Lead, Admin)-->  SUBMITTED
 *   SUBMITTED  --EDIT, RECALCULATE (Lead, Admin)-->                   SUBMITTED
 *   SUBMITTED  --APPROVE (Lead, Admin)-->                             APPROVED
 *   APPROVED   --UNLOCK (Lead, Admin) / CANCEL (Admin only)-->        DRAFT
 *   APPROVED   --EXPORT (Lead, Admin)-->                              APPROVED
 *
 * Every other (status, event) pair is refused, with a named reason. The two `switch` statements are exhaustive (`assertNever`), so a new status or a new event
 * does not type-check until each pair is decided. This file holds no cost figure and no person's data: an Engineer's page may import it (NFR-002).
 *
 * **The order of the two kinds of refusal is the order of what may be told.** The role is checked first, and a role that may never apply the event is told
 * nothing about the status; only a role that may apply the event is told why the status does not allow it. Whether the person owns the task is not here: it
 * is a fact of the row, and the service decides it before this is asked (an Engineer's other-person estimate is "not found", CR-33).
 */

export const ESTIMATE_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED'] as const;
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

/**
 * What can happen to an estimate. `CALCULATE` is the Engineer's first calculation; `RECALCULATE` is a Lead's or an Admin's. `EDIT` is a change of inputs made
 * while the estimate is SUBMITTED: an edit of a DRAFT needs no transition and is not an event (see `canEditInputs`). `EXPORT` leaves the status as it is.
 */
export const ESTIMATE_EVENTS = ['CALCULATE', 'RECALCULATE', 'EDIT', 'APPROVE', 'UNLOCK', 'CANCEL', 'EXPORT'] as const;
export type EstimateEvent = (typeof ESTIMATE_EVENTS)[number];

/** Why a pair is refused. Each is one 409 with its own code and words (`TRANSITION_REFUSALS`), so the answer says which step is missing. */
export type RefusalReason = 'NOT_SUBMITTED' | 'NOT_APPROVED' | 'ALREADY_SUBMITTED' | 'ALREADY_APPROVED' | 'APPROVED_IS_LOCKED';

export interface RefusalText {
  /** The `code` of the 409. */
  readonly code: string;
  /** Safe to show: it names the status and the step, never a figure (NFR-002). */
  readonly message: string;
}

export const TRANSITION_REFUSALS: Readonly<Record<RefusalReason, RefusalText>> = {
  NOT_SUBMITTED: { code: 'ESTIMATE_NOT_SUBMITTED', message: 'This estimate has not been submitted.' },
  NOT_APPROVED: { code: 'ESTIMATE_NOT_APPROVED', message: 'This estimate has not been approved.' },
  ALREADY_SUBMITTED: { code: 'ESTIMATE_ALREADY_SUBMITTED', message: 'This estimate has already been submitted.' },
  ALREADY_APPROVED: { code: 'ESTIMATE_ALREADY_APPROVED', message: 'This estimate has already been approved.' },
  APPROVED_IS_LOCKED: { code: 'ESTIMATE_APPROVED_IS_LOCKED', message: 'This estimate is approved and locked. Unlock it first.' },
};

/**
 * Who may apply each event (NFR-001, FR-064, FR-107). An Engineer may only Calculate (and only on their own task, which the service checks); a Lead and an
 * Admin may Recalculate, edit a submitted estimate, approve, unlock and export; only the Admin may cancel an approval. Export is the Lead's and the Admin's
 * because the file holds the costs (NFR-002); that is an assumption of STORY-06.01, as the story names no role for it.
 */
const EVENT_ROLES: Readonly<Record<EstimateEvent, ReadonlyArray<RoleName>>> = {
  CALCULATE: ['ENGINEER'],
  RECALCULATE: ['LEAD', 'ADMIN'],
  EDIT: ['LEAD', 'ADMIN'],
  APPROVE: ['LEAD', 'ADMIN'],
  UNLOCK: ['LEAD', 'ADMIN'],
  CANCEL: ['ADMIN'],
  EXPORT: ['LEAD', 'ADMIN'],
};

export type TransitionDecision =
  | { readonly allowed: true; readonly from: EstimateStatus; readonly to: EstimateStatus }
  | { readonly allowed: false; readonly kind: 'ROLE' }
  | { readonly allowed: false; readonly kind: 'STATE'; readonly reason: RefusalReason };

const allow = (from: EstimateStatus, to: EstimateStatus): TransitionDecision => ({ allowed: true, from, to });
const refuse = (reason: RefusalReason): TransitionDecision => ({ allowed: false, kind: 'STATE', reason });

/** The graph alone: where `event` leads from `status`, or why it does not. */
function followOn(status: EstimateStatus, event: EstimateEvent): TransitionDecision {
  switch (status) {
    case 'DRAFT':
      switch (event) {
        case 'CALCULATE':
        case 'RECALCULATE':
          return allow('DRAFT', 'SUBMITTED');
        case 'EDIT':
        case 'APPROVE':
          return refuse('NOT_SUBMITTED');
        case 'UNLOCK':
        case 'CANCEL':
        case 'EXPORT':
          return refuse('NOT_APPROVED');
        default:
          return assertNever(event, 'estimate event');
      }
    case 'SUBMITTED':
      switch (event) {
        case 'CALCULATE':
          return refuse('ALREADY_SUBMITTED');
        case 'RECALCULATE':
        case 'EDIT':
          return allow('SUBMITTED', 'SUBMITTED');
        case 'APPROVE':
          return allow('SUBMITTED', 'APPROVED');
        case 'UNLOCK':
        case 'CANCEL':
        case 'EXPORT':
          return refuse('NOT_APPROVED');
        default:
          return assertNever(event, 'estimate event');
      }
    case 'APPROVED':
      switch (event) {
        case 'CALCULATE':
        case 'RECALCULATE':
        case 'EDIT':
          return refuse('APPROVED_IS_LOCKED');
        case 'APPROVE':
          return refuse('ALREADY_APPROVED');
        case 'UNLOCK':
        case 'CANCEL':
          return allow('APPROVED', 'DRAFT');
        case 'EXPORT':
          return allow('APPROVED', 'APPROVED');
        default:
          return assertNever(event, 'estimate event');
      }
    default:
      return assertNever(status, 'estimate status');
  }
}

/**
 * Decides one transition. The role is judged first (a role that may never apply the event is refused as `ROLE`, whatever the status), then the pair. The
 * result says where the estimate goes; it changes nothing.
 */
export function decideTransition(status: EstimateStatus, event: EstimateEvent, role: RoleName): TransitionDecision {
  // The event is checked first against the table, so a name that is not an event is refused as a role refusal and never reaches the graph.
  if (!Object.hasOwn(EVENT_ROLES, event) || !EVENT_ROLES[event].includes(role)) return { allowed: false, kind: 'ROLE' };
  return followOn(status, event);
}
