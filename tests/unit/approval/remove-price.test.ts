import { describe, expect, it } from 'vitest';

import { ForbiddenError } from '@/lib/errors';
import type { Transaction, TransactionRunner } from '@/server/repositories/transaction';
import { createRemovePriceService } from '@/server/services/remove-price-service';
import type { StepUpCaller } from '@/server/services/step-up-service';

import { harness } from '../../support/session-harness';

/**
 * STORY-06.13 AC-3 to AC-5, AC-7: the order of the removal's checks and where the password goes, at the level of the service (the route, the records and the audit entry are `tests/unit/remove-price-route.test.ts`; the
 * row lock is `tests/integration/approval/remove-price.test.ts`). The role is judged first, the password second, and only then is a transaction opened; the password reaches `verifyStepUp` and nothing else. Every name,
 * ID and password is invented.
 */

const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', role: 'ADMIN' } as const;
const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const APPROVAL = '00000000-0000-4000-8000-0000000a9901';
const PASSWORD = 'Invented-Service-Password-9!';
const AUDIT = { actorId: ADMIN.id, actorLabel: 'Invented Admin', requestId: 'req-1a2b3c4d' };
const REQUEST = { approvalId: APPROVAL, password: PASSWORD, audit: AUDIT };

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
  return createRemovePriceService({
    estimates: harness.calculationWorld.estimates,
    approvals: harness.calculationWorld.approvalRepository,
    transactions,
    stepUp,
    audit: harness.calculationAudit.service,
  });
}

describe('the order of the checks', () => {
  it.each([
    ['a Lead', { id: 'l', role: 'LEAD' }],
    ['an Engineer', { id: 'e', role: 'ENGINEER' }],
  ] as const)('%s is refused first: neither the password nor a transaction is reached', async (_name, viewer) => {
    const stepUp = steppingUp();
    const { runner, opened } = counting();
    await expect(build(stepUp, runner).removePrice(viewer, ESTIMATE, REQUEST)).rejects.toBeInstanceOf(ForbiddenError);
    expect(stepUp.asked).toEqual([]);
    expect(opened()).toBe(0);
  });

  it("a password that is refused ends the request before any transaction is opened, so the hash never holds the estimate's lock", async () => {
    const refusal = new Error('Invented step-up refusal.');
    const stepUp = steppingUp(refusal);
    const { runner, opened } = counting();
    await expect(build(stepUp, runner).removePrice(ADMIN, ESTIMATE, REQUEST)).rejects.toBe(refusal);
    expect(stepUp.asked).toHaveLength(1);
    expect(opened()).toBe(0);
  });
});

describe('AC-7: where the password goes', () => {
  it('it is given to verifyStepUp with the signed-in person (never one from the body) and the request ID, and to nothing else', async () => {
    const stepUp = steppingUp();
    const { runner } = counting();
    // The estimate does not exist in the fake, so the call ends in the transaction with a 404 after the password passed.
    await expect(build(stepUp, runner).removePrice(ADMIN, ESTIMATE, REQUEST)).rejects.toMatchObject({ httpStatus: 404 });
    expect(stepUp.asked).toEqual([{ caller: { user: { id: ADMIN.id }, requestId: AUDIT.requestId }, password: PASSWORD }]);
    expect(JSON.stringify(AUDIT)).not.toContain(PASSWORD);
  });
});
