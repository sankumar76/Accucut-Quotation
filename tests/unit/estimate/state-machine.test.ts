import { describe, expect, it } from 'vitest';

import type { RoleName } from '@/lib/auth/roles';
import { canEditInputs } from '@/lib/estimate/can-edit-inputs';
import {
  decideTransition,
  ESTIMATE_EVENTS,
  ESTIMATE_STATUSES,
  TRANSITION_REFUSALS,
  type EstimateEvent,
  type EstimateStatus,
  type RefusalReason,
} from '@/lib/estimate/state-machine';

/**
 * STORY-06.01 T1 (AC-1, AC-2, AC-3, AC-5, AC-6): the estimate state machine, pair by pair and role by role. Every (status, event) pair and every role is
 * tried against an expected table, so a pair that is added, removed or changed makes a row of this file fail. Pure code: no storage, no clock.
 */

const ROLES: ReadonlyArray<RoleName> = ['ENGINEER', 'LEAD', 'ADMIN'];

/** Where an allowed pair leads, and for which roles. A pair that is not in this table is refused for every role. */
const ALLOWED: ReadonlyArray<{ status: EstimateStatus; event: EstimateEvent; to: EstimateStatus; roles: ReadonlyArray<RoleName> }> = [
  { status: 'DRAFT', event: 'CALCULATE', to: 'SUBMITTED', roles: ['ENGINEER'] },
  { status: 'DRAFT', event: 'RECALCULATE', to: 'SUBMITTED', roles: ['LEAD', 'ADMIN'] },
  { status: 'SUBMITTED', event: 'EDIT', to: 'SUBMITTED', roles: ['LEAD', 'ADMIN'] },
  { status: 'SUBMITTED', event: 'RECALCULATE', to: 'SUBMITTED', roles: ['LEAD', 'ADMIN'] },
  { status: 'SUBMITTED', event: 'APPROVE', to: 'APPROVED', roles: ['LEAD', 'ADMIN'] },
  { status: 'APPROVED', event: 'UNLOCK', to: 'DRAFT', roles: ['LEAD', 'ADMIN'] },
  { status: 'APPROVED', event: 'CANCEL', to: 'DRAFT', roles: ['ADMIN'] },
  { status: 'APPROVED', event: 'EXPORT', to: 'APPROVED', roles: ['LEAD', 'ADMIN'] },
];

/** The reason each refused pair names, for a role that may apply the event at all. */
const REFUSED: ReadonlyArray<{ status: EstimateStatus; event: EstimateEvent; reason: RefusalReason }> = [
  { status: 'DRAFT', event: 'EDIT', reason: 'NOT_SUBMITTED' },
  { status: 'DRAFT', event: 'APPROVE', reason: 'NOT_SUBMITTED' },
  { status: 'DRAFT', event: 'UNLOCK', reason: 'NOT_APPROVED' },
  { status: 'DRAFT', event: 'CANCEL', reason: 'NOT_APPROVED' },
  { status: 'DRAFT', event: 'EXPORT', reason: 'NOT_APPROVED' },
  { status: 'SUBMITTED', event: 'CALCULATE', reason: 'ALREADY_SUBMITTED' },
  { status: 'SUBMITTED', event: 'UNLOCK', reason: 'NOT_APPROVED' },
  { status: 'SUBMITTED', event: 'CANCEL', reason: 'NOT_APPROVED' },
  { status: 'SUBMITTED', event: 'EXPORT', reason: 'NOT_APPROVED' },
  { status: 'APPROVED', event: 'CALCULATE', reason: 'APPROVED_IS_LOCKED' },
  { status: 'APPROVED', event: 'RECALCULATE', reason: 'APPROVED_IS_LOCKED' },
  { status: 'APPROVED', event: 'EDIT', reason: 'APPROVED_IS_LOCKED' },
  { status: 'APPROVED', event: 'APPROVE', reason: 'ALREADY_APPROVED' },
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
};

describe('AC-1: every (status, event) pair is decided', () => {
  it('the table covers all 21 pairs exactly once: 8 allowed and 13 refused', () => {
    const pairs = [...ALLOWED, ...REFUSED].map((row) => `${row.status}/${row.event}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(pairs).toHaveLength(ESTIMATE_STATUSES.length * ESTIMATE_EVENTS.length);
    expect(ALLOWED).toHaveLength(8);
    expect(REFUSED).toHaveLength(13);
  });

  it.each(ALLOWED)('$status + $event leads to $to for $roles, and for no other role', ({ status, event, to, roles }) => {
    for (const role of ROLES) {
      const decision = decideTransition(status, event, role);
      if (roles.includes(role)) expect(decision).toEqual({ allowed: true, from: status, to });
      else expect(decision).toEqual({ allowed: false, kind: 'ROLE' });
    }
  });

  it.each(REFUSED)('$status + $event is refused as $reason for a role that may apply the event, and as ROLE for the others', ({ status, event, reason }) => {
    for (const role of ROLES) {
      const decision = decideTransition(status, event, role);
      if (EVENT_ROLES[event].includes(role)) expect(decision).toEqual({ allowed: false, kind: 'STATE', reason });
      else expect(decision).toEqual({ allowed: false, kind: 'ROLE' });
    }
  });

  it('every refusal reason has its own 409 code and words, and the words carry no figure or name', () => {
    const reasons = Object.keys(TRANSITION_REFUSALS);
    expect(reasons.sort()).toEqual(['ALREADY_APPROVED', 'ALREADY_SUBMITTED', 'APPROVED_IS_LOCKED', 'NOT_APPROVED', 'NOT_SUBMITTED']);
    expect(new Set(Object.values(TRANSITION_REFUSALS).map((text) => text.code)).size).toBe(reasons.length);
    for (const text of Object.values(TRANSITION_REFUSALS)) {
      expect(text.code).toMatch(/^ESTIMATE_[A-Z_]+$/);
      expect(text.message).toMatch(/^[A-Z][^0-9]*\.$/);
    }
  });

  it('a status or an event that is not one is refused and never decided: the switches are closed by assertNever', () => {
    expect(() => decideTransition('CLOSED' as never, 'CALCULATE', 'ENGINEER')).toThrow('Unhandled estimate status.');
    // An event that is not one is a role refusal first, so it never reaches the graph, whatever the status.
    expect(decideTransition('DRAFT', 'DELETE' as never, 'ADMIN')).toEqual({ allowed: false, kind: 'ROLE' });
    expect(decideTransition('DRAFT', 'toString' as never, 'ADMIN')).toEqual({ allowed: false, kind: 'ROLE' });
  });

});

describe('AC-5: roles', () => {
  it('an Engineer may only Calculate, and no other event is theirs in any status', () => {
    for (const status of ESTIMATE_STATUSES) {
      for (const event of ESTIMATE_EVENTS) {
        const refusal = decideTransition(status, event, 'ENGINEER');
        if (event === 'CALCULATE') expect(refusal.allowed || (!refusal.allowed && refusal.kind === 'STATE')).toBe(true);
        else expect(refusal).toEqual({ allowed: false, kind: 'ROLE' });
      }
    }
  });

  it('a Lead and an Admin may Recalculate, approve and unlock; only an Admin may cancel', () => {
    expect(decideTransition('SUBMITTED', 'RECALCULATE', 'LEAD').allowed).toBe(true);
    expect(decideTransition('SUBMITTED', 'RECALCULATE', 'ADMIN').allowed).toBe(true);
    expect(decideTransition('SUBMITTED', 'APPROVE', 'LEAD').allowed).toBe(true);
    expect(decideTransition('SUBMITTED', 'APPROVE', 'ADMIN').allowed).toBe(true);
    expect(decideTransition('APPROVED', 'UNLOCK', 'LEAD').allowed).toBe(true);
    expect(decideTransition('APPROVED', 'UNLOCK', 'ADMIN').allowed).toBe(true);
    expect(decideTransition('APPROVED', 'CANCEL', 'ADMIN').allowed).toBe(true);
    expect(decideTransition('APPROVED', 'CANCEL', 'LEAD')).toEqual({ allowed: false, kind: 'ROLE' });
  });

  it('a role refusal does not depend on the status, so it tells the role nothing about the estimate', () => {
    for (const status of ESTIMATE_STATUSES) {
      expect(decideTransition(status, 'CANCEL', 'LEAD')).toEqual({ allowed: false, kind: 'ROLE' });
      expect(decideTransition(status, 'APPROVE', 'ENGINEER')).toEqual({ allowed: false, kind: 'ROLE' });
    }
  });
});

describe('AC-3: a Lead or an Admin Recalculate on a DRAFT', () => {
  it.each(['LEAD', 'ADMIN'] as const)('sets SUBMITTED for a %s, the same status as the Engineer\'s Calculate', (role) => {
    expect(decideTransition('DRAFT', 'RECALCULATE', role)).toEqual({ allowed: true, from: 'DRAFT', to: 'SUBMITTED' });
    expect(decideTransition('DRAFT', 'CALCULATE', 'ENGINEER')).toEqual({ allowed: true, from: 'DRAFT', to: 'SUBMITTED' });
  });
});

describe('AC-6: unlock and cancel return an approved estimate to DRAFT', () => {
  it('both lead to DRAFT, and neither is a status the estimate skips to', () => {
    expect(decideTransition('APPROVED', 'UNLOCK', 'LEAD')).toMatchObject({ allowed: true, to: 'DRAFT' });
    expect(decideTransition('APPROVED', 'CANCEL', 'ADMIN')).toMatchObject({ allowed: true, to: 'DRAFT' });
  });
});

describe('AC-2: who may change the inputs of an estimate in each status', () => {
  const EXPECTED: ReadonlyArray<[EstimateStatus, RoleName, boolean]> = [
    ['DRAFT', 'ENGINEER', true],
    ['DRAFT', 'LEAD', true],
    ['DRAFT', 'ADMIN', true],
    ['SUBMITTED', 'ENGINEER', false],
    ['SUBMITTED', 'LEAD', true],
    ['SUBMITTED', 'ADMIN', true],
    ['APPROVED', 'ENGINEER', false],
    ['APPROVED', 'LEAD', false],
    ['APPROVED', 'ADMIN', false],
  ];

  it.each(EXPECTED)('%s, %s: %s', (status, role, expected) => {
    expect(canEditInputs(status, role)).toBe(expected);
  });

  it('covers every status and role once', () => {
    expect(EXPECTED).toHaveLength(ESTIMATE_STATUSES.length * ROLES.length);
  });

  it('an unknown status is refused by the switch', () => {
    expect(() => canEditInputs('CLOSED' as never, 'ADMIN')).toThrow('Unhandled estimate status.');
  });

  it('agrees with the machine: a SUBMITTED estimate is editable by exactly the roles of the EDIT event', () => {
    for (const role of ROLES) expect(canEditInputs('SUBMITTED', role)).toBe(decideTransition('SUBMITTED', 'EDIT', role).allowed);
  });
});
