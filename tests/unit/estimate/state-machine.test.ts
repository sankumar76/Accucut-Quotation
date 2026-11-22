import { describe, expect, it } from 'vitest';

import type { RoleName } from '@/lib/auth/roles';
import { canEditInputs } from '@/lib/estimate/can-edit-inputs';
import {
  decideTransition,
  ESTIMATE_EVENTS,
  ESTIMATE_STATUSES,
  isLocked,
  stateOf,
  TRANSITION_REFUSALS,
  type EstimateEvent,
  type EstimateState,
  type EstimateStatus,
  type RefusalReason,
  type TransitionDecision,
} from '@/lib/estimate/state-machine';

/**
 * STORY-06.01 T1 (AC-1, AC-2, AC-3, AC-5, AC-6) and CR-01 item 7B (AQP-399 AC-2 to AC-5; architecture section 4.12 a; ADR-019): the estimate state machine, pair by pair and role by
 * role. The input is `{ status, ignored }`. Every (status, ignored, event, role) combination is tried against an expected table written out here, so a pair that is added, removed or
 * changed makes a row of this file fail. Pure code: no storage, no clock.
 */

const ROLES: ReadonlyArray<RoleName> = ['ENGINEER', 'LEAD', 'ADMIN'];
const state = (status: EstimateStatus, ignored = false): EstimateState => ({ status, ignored });

/** The events that act on the status itself; IGNORE and RESTORE act on the layer over it and are tested in their own table. */
type StatusEvent = Exclude<EstimateEvent, 'IGNORE' | 'RESTORE'>;
const STATUS_EVENTS: ReadonlyArray<StatusEvent> = ['CALCULATE', 'RECALCULATE', 'EDIT', 'APPROVE', 'UNLOCK', 'CANCEL', 'EXPORT', 'MARK_QUOTED'];

/** Where an allowed pair leads, and for which roles. A pair that is not in this table is refused for every role. */
const ALLOWED: ReadonlyArray<{ status: EstimateStatus; event: StatusEvent; to: EstimateStatus; roles: ReadonlyArray<RoleName> }> = [
  { status: 'DRAFT', event: 'CALCULATE', to: 'PREPARED', roles: ['ENGINEER'] },
  { status: 'DRAFT', event: 'RECALCULATE', to: 'PREPARED', roles: ['LEAD', 'ADMIN'] },
  { status: 'PREPARED', event: 'EDIT', to: 'PREPARED', roles: ['LEAD', 'ADMIN'] },
  { status: 'PREPARED', event: 'RECALCULATE', to: 'PREPARED', roles: ['LEAD', 'ADMIN'] },
  { status: 'PREPARED', event: 'APPROVE', to: 'APPROVED', roles: ['LEAD', 'ADMIN'] },
  { status: 'APPROVED', event: 'UNLOCK', to: 'DRAFT', roles: ['LEAD', 'ADMIN'] },
  { status: 'APPROVED', event: 'CANCEL', to: 'DRAFT', roles: ['ADMIN'] },
  { status: 'APPROVED', event: 'EXPORT', to: 'APPROVED', roles: ['LEAD', 'ADMIN'] },
  // STORY-06.12 AC-10: an approval kept through an unlock is cancelled on a Draft or a Prepared estimate, and the status stays. Admin only.
  { status: 'DRAFT', event: 'CANCEL', to: 'DRAFT', roles: ['ADMIN'] },
  { status: 'PREPARED', event: 'CANCEL', to: 'PREPARED', roles: ['ADMIN'] },
  // CR-01 item 7B: Mark as quoted takes an APPROVED estimate to QUOTED (Lead, Admin).
  { status: 'APPROVED', event: 'MARK_QUOTED', to: 'QUOTED', roles: ['LEAD', 'ADMIN'] },
  // A-CR01-1 (confirmed with the customer on 2026-11-23, built as assumed): a QUOTED estimate can be unlocked or cancelled back to Draft. These two rows, and the two `QUOTED` cells of
  // `followOn` in state-machine.ts, are the whole of that assumption: a "no" turns both into ESTIMATE_QUOTED_IS_FINAL (about 0.1 d).
  { status: 'QUOTED', event: 'UNLOCK', to: 'DRAFT', roles: ['LEAD', 'ADMIN'] },
  { status: 'QUOTED', event: 'CANCEL', to: 'DRAFT', roles: ['ADMIN'] },
  { status: 'QUOTED', event: 'EXPORT', to: 'QUOTED', roles: ['LEAD', 'ADMIN'] },
];

/** The reason each refused pair names, for a role that may apply the event at all. */
const REFUSED: ReadonlyArray<{ status: EstimateStatus; event: StatusEvent; reason: RefusalReason }> = [
  { status: 'DRAFT', event: 'EDIT', reason: 'NOT_PREPARED' },
  { status: 'DRAFT', event: 'APPROVE', reason: 'NOT_PREPARED' },
  { status: 'DRAFT', event: 'UNLOCK', reason: 'NOT_APPROVED' },
  { status: 'DRAFT', event: 'EXPORT', reason: 'NOT_APPROVED' },
  { status: 'DRAFT', event: 'MARK_QUOTED', reason: 'NOT_APPROVED' },
  { status: 'PREPARED', event: 'CALCULATE', reason: 'ALREADY_PREPARED' },
  { status: 'PREPARED', event: 'UNLOCK', reason: 'NOT_APPROVED' },
  { status: 'PREPARED', event: 'EXPORT', reason: 'NOT_APPROVED' },
  { status: 'PREPARED', event: 'MARK_QUOTED', reason: 'NOT_APPROVED' },
  { status: 'APPROVED', event: 'CALCULATE', reason: 'APPROVED_IS_LOCKED' },
  { status: 'APPROVED', event: 'RECALCULATE', reason: 'APPROVED_IS_LOCKED' },
  { status: 'APPROVED', event: 'EDIT', reason: 'APPROVED_IS_LOCKED' },
  { status: 'APPROVED', event: 'APPROVE', reason: 'ALREADY_APPROVED' },
  // CR-01 item 7B AC-4: a QUOTED estimate is locked, with the same words as an APPROVED one; a second Mark as quoted is its own refusal.
  { status: 'QUOTED', event: 'CALCULATE', reason: 'APPROVED_IS_LOCKED' },
  { status: 'QUOTED', event: 'RECALCULATE', reason: 'APPROVED_IS_LOCKED' },
  { status: 'QUOTED', event: 'EDIT', reason: 'APPROVED_IS_LOCKED' },
  { status: 'QUOTED', event: 'APPROVE', reason: 'APPROVED_IS_LOCKED' },
  { status: 'QUOTED', event: 'MARK_QUOTED', reason: 'ALREADY_QUOTED' },
];

/** The roles that may apply an event at all (AC-5), whatever the status. */
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

const ROLE_REFUSAL: TransitionDecision = { allowed: false, kind: 'ROLE' };
const stateRefusal = (reason: RefusalReason): TransitionDecision => ({ allowed: false, kind: 'STATE', reason });
const allowed = (from: EstimateStatus, to: EstimateStatus, ignored = false): TransitionDecision => ({ allowed: true, from, to, ignored });

describe('AC-1 (STORY-06.01): every (status, event) pair of a not-ignored estimate is decided', () => {
  it('the table covers all 32 status events on the 4 statuses exactly once: 14 allowed and 18 refused', () => {
    const pairs = [...ALLOWED, ...REFUSED].map((row) => `${row.status}/${row.event}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(pairs).toHaveLength(ESTIMATE_STATUSES.length * STATUS_EVENTS.length);
    expect(ALLOWED).toHaveLength(14);
    expect(REFUSED).toHaveLength(18);
  });

  it.each(ALLOWED)('$status + $event leads to $to for $roles, and for no other role', ({ status, event, to, roles }) => {
    for (const role of ROLES) {
      const decision = decideTransition(state(status), event, role);
      if (roles.includes(role)) expect(decision).toEqual(allowed(status, to));
      else expect(decision).toEqual(ROLE_REFUSAL);
    }
  });

  it.each(REFUSED)('$status + $event is refused as $reason for a role that may apply the event, and as ROLE for the others', ({ status, event, reason }) => {
    for (const role of ROLES) {
      const decision = decideTransition(state(status), event, role);
      if (EVENT_ROLES[event].includes(role)) expect(decision).toEqual(stateRefusal(reason));
      else expect(decision).toEqual(ROLE_REFUSAL);
    }
  });

  it('every refusal reason has its own 409 code and words, and the words carry no figure or name', () => {
    const reasons = Object.keys(TRANSITION_REFUSALS);
    expect(reasons.sort()).toEqual([
      'ALREADY_APPROVED',
      'ALREADY_IGNORED',
      'ALREADY_PREPARED',
      'ALREADY_QUOTED',
      'APPROVED_IS_LOCKED',
      'IGNORED',
      'NOT_APPROVED',
      'NOT_IGNORED',
      'NOT_PREPARED',
      'QUOTED_IS_FINAL',
    ]);
    expect(new Set(Object.values(TRANSITION_REFUSALS).map((text) => text.code)).size).toBe(reasons.length);
    for (const text of Object.values(TRANSITION_REFUSALS)) {
      expect(text.code).toMatch(/^ESTIMATE_[A-Z_]+$/);
      expect(text.message).toMatch(/^[A-Z][^0-9]*\.$/);
    }
  });

  it('names the codes of architecture section 4.12 a, with the words of the UX spec for the ignored estimate', () => {
    expect(TRANSITION_REFUSALS.NOT_PREPARED.code).toBe('ESTIMATE_NOT_PREPARED');
    expect(TRANSITION_REFUSALS.ALREADY_PREPARED.code).toBe('ESTIMATE_ALREADY_PREPARED');
    expect(TRANSITION_REFUSALS.ALREADY_QUOTED.code).toBe('ESTIMATE_ALREADY_QUOTED');
    expect(TRANSITION_REFUSALS.QUOTED_IS_FINAL.code).toBe('ESTIMATE_QUOTED_IS_FINAL');
    expect(TRANSITION_REFUSALS.ALREADY_IGNORED.code).toBe('ESTIMATE_ALREADY_IGNORED');
    expect(TRANSITION_REFUSALS.NOT_IGNORED.code).toBe('ESTIMATE_NOT_IGNORED');
    expect(TRANSITION_REFUSALS.IGNORED).toEqual({ code: 'ESTIMATE_IGNORED', message: 'This estimate is ignored. Restore it first.' });
  });

  it('a status or an event that is not one is refused and never decided: the switches are closed by assertNever', () => {
    expect(() => decideTransition({ status: 'CLOSED' as never, ignored: false }, 'CALCULATE', 'ENGINEER')).toThrow('Unhandled estimate status.');
    // An event that is not one is a role refusal first, so it never reaches the graph, whatever the status.
    expect(decideTransition(state('DRAFT'), 'DELETE' as never, 'ADMIN')).toEqual(ROLE_REFUSAL);
    expect(decideTransition(state('DRAFT'), 'toString' as never, 'ADMIN')).toEqual(ROLE_REFUSAL);
    expect(decideTransition(state('DRAFT', true), 'DELETE' as never, 'ADMIN')).toEqual(ROLE_REFUSAL);
  });
});

describe('AQP-399 AC-2: the whole table, every (status, ignored, event, role) combination', () => {
  /** The expected decision, from the tables above and the layer rules of architecture section 4.12 a; written independently of the machine. */
  function expected(input: EstimateState, event: EstimateEvent, role: RoleName): TransitionDecision {
    if (!EVENT_ROLES[event].includes(role)) return ROLE_REFUSAL;
    if (input.ignored) {
      if (event === 'RESTORE') return allowed(input.status, input.status, false);
      if (event === 'IGNORE') return stateRefusal('ALREADY_IGNORED');
      return stateRefusal('IGNORED');
    }
    if (event === 'RESTORE') return stateRefusal('NOT_IGNORED');
    if (event === 'IGNORE') return input.status === 'QUOTED' ? stateRefusal('QUOTED_IS_FINAL') : allowed(input.status, input.status, true);
    const row = ALLOWED.find((candidate) => candidate.status === input.status && candidate.event === event);
    if (row !== undefined) return allowed(input.status, row.to);
    const refusal = REFUSED.find((candidate) => candidate.status === input.status && candidate.event === event);
    if (refusal === undefined) throw new Error(`The tables above do not decide ${input.status}/${event}.`);
    return stateRefusal(refusal.reason);
  }

  const combinations = ESTIMATE_STATUSES.flatMap((status) => [false, true].flatMap((ignored) => ESTIMATE_EVENTS.flatMap((event) => ROLES.map((role) => [status, ignored, event, role] as const))));

  it('has 4 statuses, 2 layer values, 10 events and 3 roles: 240 combinations', () => {
    expect(ESTIMATE_STATUSES).toEqual(['DRAFT', 'PREPARED', 'APPROVED', 'QUOTED']);
    expect(ESTIMATE_EVENTS).toEqual(['CALCULATE', 'RECALCULATE', 'EDIT', 'APPROVE', 'UNLOCK', 'CANCEL', 'EXPORT', 'MARK_QUOTED', 'IGNORE', 'RESTORE']);
    expect(combinations).toHaveLength(240);
  });

  it('decides every combination as the table says', () => {
    for (const [status, ignored, event, role] of combinations) {
      expect(decideTransition({ status, ignored }, event, role), `${status} ignored=${String(ignored)} ${event} ${role}`).toEqual(expected({ status, ignored }, event, role));
    }
  });

  it('refuses the role before the state: a role that may never apply the event is told nothing about the status or the layer', () => {
    for (const status of ESTIMATE_STATUSES) {
      for (const ignored of [false, true]) {
        expect(decideTransition({ status, ignored }, 'MARK_QUOTED', 'ENGINEER')).toEqual(ROLE_REFUSAL);
        expect(decideTransition({ status, ignored }, 'IGNORE', 'ENGINEER')).toEqual(ROLE_REFUSAL);
        expect(decideTransition({ status, ignored }, 'RESTORE', 'ENGINEER')).toEqual(ROLE_REFUSAL);
        expect(decideTransition({ status, ignored }, 'CANCEL', 'LEAD')).toEqual(ROLE_REFUSAL);
      }
    }
  });
});

describe('AQP-399 AC-2: Mark as quoted, Ignore and Restore', () => {
  it.each(['LEAD', 'ADMIN'] as const)('%s may mark an Approved estimate as quoted; an Engineer may not', (role) => {
    expect(decideTransition(state('APPROVED'), 'MARK_QUOTED', role)).toEqual(allowed('APPROVED', 'QUOTED'));
    expect(decideTransition(state('APPROVED'), 'MARK_QUOTED', 'ENGINEER')).toEqual(ROLE_REFUSAL);
  });

  it.each(['DRAFT', 'PREPARED', 'APPROVED'] as const)('Ignore keeps the status underneath, %s, and only sets the layer; Restore puts it back exactly', (status) => {
    for (const role of ['LEAD', 'ADMIN'] as const) {
      const ignored = decideTransition(state(status), 'IGNORE', role);
      expect(ignored).toEqual(allowed(status, status, true));
      const restored = decideTransition(state(status, true), 'RESTORE', role);
      expect(restored).toEqual(allowed(status, status, false));
    }
  });

  it('Ignore from QUOTED is final: ESTIMATE_QUOTED_IS_FINAL', () => {
    for (const role of ['LEAD', 'ADMIN'] as const) expect(decideTransition(state('QUOTED'), 'IGNORE', role)).toEqual(stateRefusal('QUOTED_IS_FINAL'));
  });

  it('Ignore on an ignored estimate is ESTIMATE_ALREADY_IGNORED, and Restore on one that is not ignored is ESTIMATE_NOT_IGNORED', () => {
    expect(decideTransition(state('PREPARED', true), 'IGNORE', 'LEAD')).toEqual(stateRefusal('ALREADY_IGNORED'));
    expect(decideTransition(state('PREPARED'), 'RESTORE', 'ADMIN')).toEqual(stateRefusal('NOT_IGNORED'));
  });

  it('an ignored estimate refuses every event but Restore with ESTIMATE_IGNORED, Export included (the product-manager\'s ruling DL-300 (2))', () => {
    for (const status of ESTIMATE_STATUSES) {
      for (const event of STATUS_EVENTS) {
        for (const role of ROLES) {
          const decision = decideTransition(state(status, true), event, role);
          if (EVENT_ROLES[event].includes(role)) expect(decision, `${status} ${event} ${role}`).toEqual(stateRefusal('IGNORED'));
          else expect(decision).toEqual(ROLE_REFUSAL);
        }
      }
    }
  });

  it('QUOTED and ignored together never arise (ck_estimates_quoted_not_ignored); if they did, the layer would still come first', () => {
    expect(decideTransition(state('QUOTED', true), 'RESTORE', 'LEAD')).toEqual(allowed('QUOTED', 'QUOTED', false));
    expect(decideTransition(state('QUOTED', true), 'EXPORT', 'LEAD')).toEqual(stateRefusal('IGNORED'));
  });

  it('builds the state from a row: a time set means ignored, null means not', () => {
    expect(stateOf({ status: 'DRAFT', ignoredAt: null })).toEqual({ status: 'DRAFT', ignored: false });
    expect(stateOf({ status: 'APPROVED', ignoredAt: new Date('2026-11-23T10:00:00Z') })).toEqual({ status: 'APPROVED', ignored: true });
  });
});

describe('AQP-399 AC-3: isLocked', () => {
  it('is true for APPROVED and QUOTED, false for DRAFT and PREPARED, and covers every status', () => {
    expect(ESTIMATE_STATUSES.filter(isLocked)).toEqual(['APPROVED', 'QUOTED']);
    expect(ESTIMATE_STATUSES.filter((status) => !isLocked(status))).toEqual(['DRAFT', 'PREPARED']);
  });

  it('agrees with the machine: a locked status refuses Calculate, Recalculate and Edit with the locked words, and an unlocked one never does', () => {
    for (const status of ESTIMATE_STATUSES) {
      for (const event of ['CALCULATE', 'RECALCULATE', 'EDIT'] as const) {
        const decision = decideTransition(state(status), event, event === 'CALCULATE' ? 'ENGINEER' : 'LEAD');
        const locked = !decision.allowed && decision.kind === 'STATE' && decision.reason === 'APPROVED_IS_LOCKED';
        expect(locked, `${status} ${event}`).toBe(isLocked(status));
      }
    }
  });

  it('a status that is not one throws, so bad data never gets a guessed answer', () => {
    expect(() => isLocked('CLOSED' as never)).toThrow('Unhandled estimate status.');
  });
});

describe('AC-5 (STORY-06.01): roles', () => {
  it('an Engineer may only Calculate, and no other event is theirs in any status', () => {
    for (const status of ESTIMATE_STATUSES) {
      for (const event of ESTIMATE_EVENTS) {
        const refusal = decideTransition(state(status), event, 'ENGINEER');
        if (event === 'CALCULATE') expect(refusal.allowed || (!refusal.allowed && refusal.kind === 'STATE')).toBe(true);
        else expect(refusal).toEqual(ROLE_REFUSAL);
      }
    }
  });

  it('a Lead and an Admin may Recalculate, approve and unlock; only an Admin may cancel', () => {
    expect(decideTransition(state('PREPARED'), 'RECALCULATE', 'LEAD').allowed).toBe(true);
    expect(decideTransition(state('PREPARED'), 'RECALCULATE', 'ADMIN').allowed).toBe(true);
    expect(decideTransition(state('PREPARED'), 'APPROVE', 'LEAD').allowed).toBe(true);
    expect(decideTransition(state('PREPARED'), 'APPROVE', 'ADMIN').allowed).toBe(true);
    expect(decideTransition(state('APPROVED'), 'UNLOCK', 'LEAD').allowed).toBe(true);
    expect(decideTransition(state('APPROVED'), 'UNLOCK', 'ADMIN').allowed).toBe(true);
    expect(decideTransition(state('APPROVED'), 'CANCEL', 'ADMIN').allowed).toBe(true);
    expect(decideTransition(state('APPROVED'), 'CANCEL', 'LEAD')).toEqual(ROLE_REFUSAL);
  });

  it('a role refusal does not depend on the status, so it tells the role nothing about the estimate', () => {
    for (const status of ESTIMATE_STATUSES) {
      expect(decideTransition(state(status), 'CANCEL', 'LEAD')).toEqual(ROLE_REFUSAL);
      expect(decideTransition(state(status), 'APPROVE', 'ENGINEER')).toEqual(ROLE_REFUSAL);
    }
  });
});

describe('AC-3 (STORY-06.01): a Lead or an Admin Recalculate on a DRAFT', () => {
  it.each(['LEAD', 'ADMIN'] as const)("sets PREPARED for a %s, the same status as the Engineer's Calculate", (role) => {
    expect(decideTransition(state('DRAFT'), 'RECALCULATE', role)).toEqual(allowed('DRAFT', 'PREPARED'));
    expect(decideTransition(state('DRAFT'), 'CALCULATE', 'ENGINEER')).toEqual(allowed('DRAFT', 'PREPARED'));
  });
});

describe('AC-6 (STORY-06.01) and AQP-399 AC-5: unlock and cancel return an approved or quoted estimate to DRAFT', () => {
  it('both lead to DRAFT from APPROVED and from QUOTED, and neither is a status the estimate skips to', () => {
    for (const status of ['APPROVED', 'QUOTED'] as const) {
      expect(decideTransition(state(status), 'UNLOCK', 'LEAD')).toMatchObject({ allowed: true, to: 'DRAFT', ignored: false });
      expect(decideTransition(state(status), 'CANCEL', 'ADMIN')).toMatchObject({ allowed: true, to: 'DRAFT', ignored: false });
    }
  });
});

describe('AC-2 (STORY-06.01) and AQP-399: who may change the inputs of an estimate in each status', () => {
  const EXPECTED: ReadonlyArray<[EstimateStatus, boolean, RoleName, boolean]> = [
    ['DRAFT', false, 'ENGINEER', true],
    ['DRAFT', false, 'LEAD', true],
    ['DRAFT', false, 'ADMIN', true],
    ['PREPARED', false, 'ENGINEER', false],
    ['PREPARED', false, 'LEAD', true],
    ['PREPARED', false, 'ADMIN', true],
    ['APPROVED', false, 'ENGINEER', false],
    ['APPROVED', false, 'LEAD', false],
    ['APPROVED', false, 'ADMIN', false],
    ['QUOTED', false, 'ENGINEER', false],
    ['QUOTED', false, 'LEAD', false],
    ['QUOTED', false, 'ADMIN', false],
    // DL-300 (1): nobody changes the inputs of an ignored estimate, whatever its status underneath.
    ['DRAFT', true, 'ENGINEER', false],
    ['DRAFT', true, 'LEAD', false],
    ['DRAFT', true, 'ADMIN', false],
    ['PREPARED', true, 'ENGINEER', false],
    ['PREPARED', true, 'LEAD', false],
    ['PREPARED', true, 'ADMIN', false],
    ['APPROVED', true, 'ENGINEER', false],
    ['APPROVED', true, 'LEAD', false],
    ['APPROVED', true, 'ADMIN', false],
  ];

  it.each(EXPECTED)('%s, ignored %s, %s: %s', (status, ignored, role, expectedAnswer) => {
    expect(canEditInputs({ status, ignored }, role)).toBe(expectedAnswer);
  });

  it('covers every role for every status once, and every ignored status but QUOTED (which cannot be ignored)', () => {
    expect(EXPECTED).toHaveLength(ESTIMATE_STATUSES.length * ROLES.length + 3 * ROLES.length);
  });

  it('an unknown status is refused by the switch', () => {
    expect(() => canEditInputs({ status: 'CLOSED' as never, ignored: false }, 'ADMIN')).toThrow('Unhandled estimate status.');
  });

  it('agrees with the machine: a PREPARED estimate is editable by exactly the roles of the EDIT event, and a locked one by none', () => {
    for (const role of ROLES) expect(canEditInputs(state('PREPARED'), role)).toBe(decideTransition(state('PREPARED'), 'EDIT', role).allowed);
    for (const status of ESTIMATE_STATUSES.filter(isLocked)) for (const role of ROLES) expect(canEditInputs(state(status), role), `${status} ${role}`).toBe(false);
  });
});
