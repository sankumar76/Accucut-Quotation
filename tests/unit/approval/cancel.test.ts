import { describe, expect, it } from 'vitest';

import { ForbiddenError } from '@/lib/errors';
import type { Transaction, TransactionRunner } from '@/server/repositories/transaction';
import { createCancelApprovalService } from '@/server/services/cancel-approval-service';
import type { StepUpCaller } from '@/server/services/step-up-service';

import { defined } from '../../support/defined';
import { harness } from '../../support/session-harness';

/**
 * STORY-06.12 AC-3, AC-4, AC-7: the order of the cancel's checks and where the password goes, at the level of the service (the route, the records and the audit entry are `tests/unit/cancel-approval-route.test.ts`; the
 * row lock is `tests/integration/approval/cancel.test.ts`). The role is judged first, the reason second, the password third, and only then is a transaction opened; the password reaches `verifyStepUp` and nothing else;
 * a status the machine would answer that is none is a fault, never a guess. Every name, ID and password is invented.
 */

const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', role: 'ADMIN' } as const;
const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const APPROVAL = '00000000-0000-4000-8000-0000000a9901';
const PASSWORD = 'Invented-Service-Password-9!';
const AUDIT = { actorId: ADMIN.id, actorLabel: 'Invented Admin', requestId: 'req-1a2b3c4d' };
const REQUEST = { approvalId: APPROVAL, reason: 'The wrong customer was priced.', password: PASSWORD, audit: AUDIT };

/** A step-up that records what it was asked and either passes or refuses with the error it was given. */
function steppingUp(refusal?: Error) {
  const asked: Array<{ readonly caller: StepUpCaller; readonly password: string }> = [];
  return {
    asked,
    verifyStepUp: (caller: StepUpCaller, password: string): Promise<void> => {
      asked.push({ caller, password });
      return refusal === undefined ? Promise.resolve() : Promise.reject(refusal);
    },
  };
}

/** The real fake transaction runner of the world, counting how many transactions were opened. */
function counting(): { readonly runner: TransactionRunner; readonly opened: () => number } {
  let opened = 0;
  return {
    opened: () => opened,
    runner: {
      run: <T>(work: (tx: Transaction) => Promise<T>) => {
        opened += 1;
        return harness.calculationWorld.transactions.run(work);
      },
    },
  };
}

function build(stepUp: ReturnType<typeof steppingUp>, transactions: TransactionRunner) {
  return createCancelApprovalService({
    estimates: harness.calculationWorld.estimates,
    approvals: harness.calculationWorld.approvalRepository,
    transactions,
    stepUp,
    workflow: { transition: harness.estimateService.transition, audit: harness.calculationAudit.service },
  });
}

describe('the order of the checks', () => {
  it.each([
    ['a Lead', { id: 'l', role: 'LEAD' }],
    ['an Engineer', { id: 'e', role: 'ENGINEER' }],
  ] as const)('%s is refused first: neither the reason, nor the password, nor a transaction is reached', async (_name, viewer) => {
    const stepUp = steppingUp();
    const { runner, opened } = counting();
    await expect(build(stepUp, runner).cancel(viewer, ESTIMATE, { ...REQUEST, reason: '' })).rejects.toBeInstanceOf(ForbiddenError);
    expect(stepUp.asked).toEqual([]);
    expect(opened()).toBe(0);
  });

  it('a reason that is refused is judged before the password: no attempt is spent on a request that could not have worked', async () => {
    const stepUp = steppingUp();
    const { runner, opened } = counting();
    await expect(build(stepUp, runner).cancel(ADMIN, ESTIMATE, { ...REQUEST, reason: '  ' })).rejects.toMatchObject({ httpStatus: 422 });
    expect(stepUp.asked).toEqual([]);
    expect(opened()).toBe(0);
  });

  it('a password that is refused ends the request before any transaction is opened, so the hash never holds the estimate\'s lock', async () => {
    const refusal = new Error('Invented step-up refusal.');
    const stepUp = steppingUp(refusal);
    const { runner, opened } = counting();
    await expect(build(stepUp, runner).cancel(ADMIN, ESTIMATE, REQUEST)).rejects.toBe(refusal);
    expect(stepUp.asked).toHaveLength(1);
    expect(opened()).toBe(0);
  });
});

describe('AC-7: where the password goes', () => {
  it('it is given to verifyStepUp with the signed-in person (never one from the body) and the request ID, and to nothing else', async () => {
    const stepUp = steppingUp();
    const { runner } = counting();
    // The estimate does not exist in the fake, so the call ends in the transaction with a 404 after the password passed.
    await expect(build(stepUp, runner).cancel(ADMIN, ESTIMATE, REQUEST)).rejects.toMatchObject({ httpStatus: 404 });
    expect(stepUp.asked).toEqual([{ caller: { user: { id: ADMIN.id }, requestId: AUDIT.requestId }, password: PASSWORD }]);
    expect(JSON.stringify(AUDIT)).not.toContain(PASSWORD);
  });
});

describe('a status that is not one of the two the machine leads to is a fault', () => {
  it.each(['APPROVED', 'QUOTED'] as const)('a transition that would leave the estimate %s is refused too: locked is APPROVED or QUOTED', async (locked) => {
    const world = harness.calculationWorld;
    const estimate = defined(harness.estimateWorld.estimates[0]);
    const entries = harness.calculationAudit.rows.length;
    const service = createCancelApprovalService({
      estimates: world.estimates,
      approvals: world.approvalRepository,
      transactions: world.transactions,
      stepUp: steppingUp(),
      workflow: { transition: (_viewer, id) => Promise.resolve({ id, from: locked, to: locked }), audit: harness.calculationAudit.service },
    });
    const approval = await world.approvalRepository.insertApproval(
      { estimateId: estimate.id, calculationId: ESTIMATE, approvedPrice: '1.00', calculatedTotal: '1.00', approvedById: ADMIN.id, isOverride: false, overrideReason: null },
      {} as Transaction,
    );
    try {
      await expect(service.cancel(ADMIN, estimate.id, { ...REQUEST, approvalId: approval.id })).rejects.toThrow('would leave the estimate APPROVED or QUOTED');
      expect(harness.calculationAudit.rows).toHaveLength(entries);
    } finally {
      world.approvals.length = 0;
    }
  });

  it('a transition that would leave the estimate APPROVED is refused before anything is stored or recorded', async () => {
    const world = harness.calculationWorld;
    const estimate = defined(harness.estimateWorld.estimates[0]);
    const entries = harness.calculationAudit.rows.length;
    const service = createCancelApprovalService({
      estimates: world.estimates,
      approvals: world.approvalRepository,
      transactions: world.transactions,
      stepUp: steppingUp(),
      // A machine changed to answer APPROVED to APPROVED for CANCEL: the service must not store a cancel on that.
      workflow: { transition: (_viewer, id) => Promise.resolve({ id, from: 'APPROVED', to: 'APPROVED' }), audit: harness.calculationAudit.service },
    });
    const approval = await world.approvalRepository.insertApproval(
      { estimateId: estimate.id, calculationId: ESTIMATE, approvedPrice: '1.00', calculatedTotal: '1.00', approvedById: ADMIN.id, isOverride: false, overrideReason: null },
      {} as Transaction,
    );
    try {
      await expect(service.cancel(ADMIN, estimate.id, { ...REQUEST, approvalId: approval.id })).rejects.toThrow('would leave the estimate APPROVED');
      expect(harness.calculationAudit.rows).toHaveLength(entries);
      expect(world.approvals.every((row) => row.cancel === undefined)).toBe(true);
    } finally {
      world.approvals.length = 0;
    }
  });
});
