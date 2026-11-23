import { assertNever } from '../assert-never';
import type { RoleName } from '../auth/roles';

/**
 * The estimate state machine (STORY-06.01; FR-064; architecture sections 4.4 and 4.12 a; ADR-019). Pure code, no I/O: it answers one question, "may this role apply this event to
 * an estimate in this state, and what state follows?", and every server rule about status asks it, so no action can run in the wrong status and no input can change when it must not.
 *
 * The state is `{ status, ignored }`: the status is the stored `estimates.status`, and **Ignored is a layer over it, not a status** (ADR-019), so the status underneath is kept and Restore
 * cannot lose it. The graph of the status, for a not-ignored estimate:
 *
 *   DRAFT      --CALCULATE (Engineer) / RECALCULATE (Lead, Admin)-->  PREPARED
 *   PREPARED   --EDIT, RECALCULATE (Lead, Admin)-->                   PREPARED
 *   PREPARED   --APPROVE (Lead, Admin)-->                             APPROVED
 *   APPROVED   --UNLOCK (Lead, Admin) / CANCEL (Admin only)-->        DRAFT
 *   APPROVED   --EXPORT (Lead, Admin)-->                              APPROVED
 *   APPROVED   --MARK_QUOTED (Lead, Admin)-->                         QUOTED
 *   QUOTED     --UNLOCK (Lead, Admin) / CANCEL (Admin only)-->        DRAFT      (A-CR01-1, confirmed 2026-11-23, AQP-1 comment 12832: the two `QUOTED` cells of `followOn`)
 *   QUOTED     --EXPORT (Lead, Admin)-->                              QUOTED
 *   DRAFT      --CANCEL (Admin only)-->                               DRAFT      (STORY-06.12 AC-10: an approval kept through an unlock is cancelled; the status stays)
 *   PREPARED   --CANCEL (Admin only)-->                               PREPARED   (the same)
 *
 * The layer: IGNORE (Lead, Admin) sets it on a DRAFT, PREPARED or APPROVED estimate and RESTORE (Lead, Admin) clears it; the status does not change in either. An ignored estimate refuses
 * every other event with `ESTIMATE_IGNORED`, and a QUOTED one cannot be ignored (`ESTIMATE_QUOTED_IS_FINAL`).
 *
 * Every other pair is refused, with a named reason. The `switch` statements are exhaustive (`assertNever`), so a new status or a new event does not type-check until each pair is decided. This
 * file holds no cost figure and no person's data: an Engineer's page may import it (NFR-002).
 *
 * **The order of the two kinds of refusal is the order of what may be told.** The role is checked first, and a role that may never apply the event is told nothing about the status or the layer;
 * only a role that may apply the event is told why the state does not allow it. Whether the person owns the task is not here: it is a fact of the row, and the service decides it before this
 * is asked (an Engineer's other-person estimate is "not found", CR-33).
 */

export const ESTIMATE_STATUSES = ['DRAFT', 'PREPARED', 'APPROVED', 'QUOTED'] as const;
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

/** What a decision is made on: the stored status, and whether the Ignored layer is set over it (`estimates.ignored_at` is not null). */
export interface EstimateState {
  readonly status: EstimateStatus;
  readonly ignored: boolean;
}

/** The state of an estimate row: ignored exactly when `ignoredAt` is set, so the layer is read from the one column and never from a second place. */
export const stateOf = (row: { readonly status: EstimateStatus; readonly ignoredAt: Date | null }): EstimateState => ({ status: row.status, ignored: row.ignoredAt !== null });

/**
 * What can happen to an estimate. `CALCULATE` is the Engineer's first calculation; `RECALCULATE` is a Lead's or an Admin's. `EDIT` is a change of inputs made
 * while the estimate is PREPARED: an edit of a DRAFT needs no transition and is not an event (see `canEditInputs`). `EXPORT` leaves the status as it is. `MARK_QUOTED` is the Lead's or
 * the Admin's mark that the quote went to the customer (CR-01 item 7). `IGNORE` and `RESTORE` set and clear the Ignored layer.
 */
export const ESTIMATE_EVENTS = ['CALCULATE', 'RECALCULATE', 'EDIT', 'APPROVE', 'UNLOCK', 'CANCEL', 'EXPORT', 'MARK_QUOTED', 'IGNORE', 'RESTORE'] as const;
export type EstimateEvent = (typeof ESTIMATE_EVENTS)[number];

/** The events that act on the status; `IGNORE` and `RESTORE` act on the layer over it and are decided before the graph is asked. */
type StatusEvent = Exclude<EstimateEvent, 'IGNORE' | 'RESTORE'>;

/**
 * `isLocked`: an approved or a quoted estimate cannot be changed, calculated again or approved again until it is unlocked (architecture section 4.12 a). **The one place that says
 * so.** Every "this status is APPROVED, so it is locked" test in the code asks it, so a QUOTED estimate cannot be left editable by a test that names APPROVED alone. The `switch` is
 * exhaustive: a new status does not type-check until its answer is decided.
 */
export function isLocked(status: EstimateStatus): status is 'APPROVED' | 'QUOTED' {
  switch (status) {
    case 'DRAFT':
    case 'PREPARED':
      return false;
    case 'APPROVED':
    case 'QUOTED':
      return true;
    default:
      return assertNever(status, 'estimate status');
  }
}

/** The statuses `isLocked` holds true for, for a query that filters on them (`NOT IN` for Open, `IN` for Closed). Derived from `isLocked`, so a status added there is added here. */
export const LOCKED_STATUSES: ReadonlyArray<EstimateStatus> = ESTIMATE_STATUSES.filter(isLocked);

/** Why a pair is refused. Each is one 409 with its own code and words (`TRANSITION_REFUSALS`), so the answer says which step is missing. */
export type RefusalReason =
  | 'NOT_PREPARED'
  | 'NOT_APPROVED'
  | 'ALREADY_PREPARED'
  | 'ALREADY_APPROVED'
  | 'APPROVED_IS_LOCKED'
  | 'ALREADY_QUOTED'
  | 'QUOTED_IS_FINAL'
  | 'ALREADY_IGNORED'
  | 'NOT_IGNORED'
  | 'IGNORED';

export interface RefusalText {
  /** The `code` of the 409. */
  readonly code: string;
  /** Safe to show: it names the status and the step, never a figure (NFR-002). */
  readonly message: string;
}

export const TRANSITION_REFUSALS: Readonly<Record<RefusalReason, RefusalText>> = {
  NOT_PREPARED: { code: 'ESTIMATE_NOT_PREPARED', message: 'This estimate has not been prepared.' },
  NOT_APPROVED: { code: 'ESTIMATE_NOT_APPROVED', message: 'This estimate has not been approved.' },
  ALREADY_PREPARED: { code: 'ESTIMATE_ALREADY_PREPARED', message: 'This estimate has already been prepared.' },
  ALREADY_APPROVED: { code: 'ESTIMATE_ALREADY_APPROVED', message: 'This estimate has already been approved.' },
  // A QUOTED estimate is refused with the same code and words as an APPROVED one: the person is told it is locked and what to do about it.
  APPROVED_IS_LOCKED: { code: 'ESTIMATE_APPROVED_IS_LOCKED', message: 'This estimate is approved and locked. Unlock it first.' },
  ALREADY_QUOTED: { code: 'ESTIMATE_ALREADY_QUOTED', message: 'This estimate has already been marked as quoted.' },
  QUOTED_IS_FINAL: { code: 'ESTIMATE_QUOTED_IS_FINAL', message: 'This estimate is quoted and cannot be ignored.' },
  ALREADY_IGNORED: { code: 'ESTIMATE_ALREADY_IGNORED', message: 'This estimate is already ignored.' },
  NOT_IGNORED: { code: 'ESTIMATE_NOT_IGNORED', message: 'This estimate is not ignored.' },
  IGNORED: { code: 'ESTIMATE_IGNORED', message: 'This estimate is ignored. Restore it first.' },
};

/**
 * Who may apply each event (NFR-001, FR-064, FR-107). An Engineer may only Calculate (and only on their own task, which the service checks); a Lead and an
 * Admin may Recalculate, edit a prepared estimate, approve, unlock, export, mark as quoted, ignore and restore; only the Admin may cancel an approval. Export is the Lead's and the Admin's
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
  MARK_QUOTED: ['LEAD', 'ADMIN'],
  IGNORE: ['LEAD', 'ADMIN'],
  RESTORE: ['LEAD', 'ADMIN'],
};

/**
 * `from` and `to` are the status before and after (equal for an event that leaves it); `ignored` is whether the Ignored layer is set **after** the event: true only for `IGNORE`, and
 * false for every other allowed event (an ignored estimate allows only `RESTORE`).
 */
export type TransitionDecision =
  | { readonly allowed: true; readonly from: EstimateStatus; readonly to: EstimateStatus; readonly ignored: boolean }
  | { readonly allowed: false; readonly kind: 'ROLE' }
  | { readonly allowed: false; readonly kind: 'STATE'; readonly reason: RefusalReason };

const allow = (from: EstimateStatus, to: EstimateStatus, ignored = false): TransitionDecision => ({ allowed: true, from, to, ignored });
const refuse = (reason: RefusalReason): TransitionDecision => ({ allowed: false, kind: 'STATE', reason });

/** The graph of the status alone, for an estimate that is not ignored: where `event` leads from `status`, or why it does not. */
function followOn(status: EstimateStatus, event: StatusEvent): TransitionDecision {
  switch (status) {
    case 'DRAFT':
      switch (event) {
        case 'CALCULATE':
        case 'RECALCULATE':
          return allow('DRAFT', 'PREPARED');
        case 'EDIT':
        case 'APPROVE':
          return refuse('NOT_PREPARED');
        case 'CANCEL':
          // An approval kept through an unlock (architecture sections 4.8 and 4.10): the Admin may cancel it and the status does not change. Admin only: `EVENT_ROLES` refuses every other role first.
          return allow('DRAFT', 'DRAFT');
        case 'UNLOCK':
        case 'EXPORT':
        case 'MARK_QUOTED':
          return refuse('NOT_APPROVED');
        default:
          return assertNever(event, 'estimate event');
      }
    case 'PREPARED':
      switch (event) {
        case 'CALCULATE':
          return refuse('ALREADY_PREPARED');
        case 'RECALCULATE':
        case 'EDIT':
          return allow('PREPARED', 'PREPARED');
        case 'APPROVE':
          return allow('PREPARED', 'APPROVED');
        case 'CANCEL':
          return allow('PREPARED', 'PREPARED');
        case 'UNLOCK':
        case 'EXPORT':
        case 'MARK_QUOTED':
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
        case 'MARK_QUOTED':
          return allow('APPROVED', 'QUOTED');
        default:
          return assertNever(event, 'estimate event');
      }
    case 'QUOTED':
      switch (event) {
        case 'CALCULATE':
        case 'RECALCULATE':
        case 'EDIT':
        case 'APPROVE':
          return refuse('APPROVED_IS_LOCKED');
        case 'UNLOCK':
        case 'CANCEL':
          // **A-CR01-1, confirmed 2026-11-23 (AQP-1 comment 12832, "Yes, both, as built")**: an Approved or Quoted estimate can be unlocked back to Draft, and the Admin can cancel the approval from Quoted. These two cells
          // are the **only** way back from QUOTED (A-CR01-3: no undo apart from Unlock, so there is no `UNMARK_QUOTED` event). `QUOTED_IS_FINAL` is kept for Ignore alone (`layerEvent`).
          return allow('QUOTED', 'DRAFT');
        case 'EXPORT':
          return allow('QUOTED', 'QUOTED');
        case 'MARK_QUOTED':
          return refuse('ALREADY_QUOTED');
        default:
          return assertNever(event, 'estimate event');
      }
    default:
      return assertNever(status, 'estimate status');
  }
}

/** The layer events, for an estimate that is not ignored (`IGNORE`) and one that is (`RESTORE`). The status is never changed by either. */
function layerEvent(input: EstimateState, event: 'IGNORE' | 'RESTORE'): TransitionDecision {
  if (event === 'RESTORE') return input.ignored ? allow(input.status, input.status, false) : refuse('NOT_IGNORED');
  if (input.ignored) return refuse('ALREADY_IGNORED');
  // A QUOTED estimate is final: the quote has gone to the customer, so it cannot leave the Closed tab by being ignored. (ck_estimates_quoted_not_ignored holds the same line in the database.)
  return input.status === 'QUOTED' ? refuse('QUOTED_IS_FINAL') : allow(input.status, input.status, true);
}

/**
 * Decides one transition. The role is judged first (a role that may never apply the event is refused as `ROLE`, whatever the state), then the layer, then the status. The result says
 * where the estimate goes; it changes nothing.
 */
export function decideTransition(input: EstimateState, event: EstimateEvent, role: RoleName): TransitionDecision {
  // The event is checked first against the table, so a name that is not an event is refused as a role refusal and never reaches the graph.
  if (!Object.hasOwn(EVENT_ROLES, event) || !EVENT_ROLES[event].includes(role)) return { allowed: false, kind: 'ROLE' };
  if (event === 'IGNORE' || event === 'RESTORE') return layerEvent(input, event);
  // An ignored estimate is read-only until it is restored: every event that is not the Restore, Export included, is refused with one code.
  if (input.ignored) return refuse('IGNORED');
  return followOn(input.status, event);
}
