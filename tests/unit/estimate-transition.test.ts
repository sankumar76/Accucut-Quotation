import { describe, expect, it } from 'vitest';

import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { TRANSITION_REFUSALS, type EstimateEvent, type EstimateStatus } from '@/lib/estimate/state-machine';
import type { Transaction, TransactionRunner } from '@/server/repositories/transaction';
import {
  assertEditable,
  createEstimateService,
  ESTIMATE_NOT_EDITABLE_CODE,
  NOT_EDITABLE_MESSAGE,
  type EstimateViewer,
} from '@/server/services/estimate-service';

import { inputsDependencies } from '../support/estimate-inputs-deps';
import { createFakeEstimateWorld, type FakeEstimate } from '../support/fake-estimates';
import { changeContext } from '../support/customer-change';
import { createAuditSink } from '../support/fake-audit-sink';

/**
 * STORY-06.01 T2 to T4 (AC-2, AC-3, AC-4, AC-5, AC-6): the estimate service's `transition` and the shared `assertEditable`, over in-memory storage whose
 * transactions run one at a time, as the estimate's row lock makes them. The real lock is `tests/integration/estimates/transition.test.ts`. Every name and ID is
 * invented.
 */

const ARJUN = '00000000-0000-4000-8000-0000000000a1';
const PRIYA = '00000000-0000-4000-8000-0000000000a2';
const LEAD = '00000000-0000-4000-8000-0000000000b1';
const ADMIN = '00000000-0000-4000-8000-0000000000c1';
const CUSTOMER = '00000000-0000-4000-8000-000000000c01';
const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';

const estimate = (overrides: Partial<FakeEstimate> = {}): FakeEstimate => ({
  id: ESTIMATE,
  code: 'Q-2026-0318',
  engineerId: ARJUN,
  assignedByName: 'Kiran Bose',
  folderPath: '\\\\invented-server\\invented-share\\RFQ-123',
  deadlineAt: new Date('2026-11-12T11:30:00.000Z'),
  title: null,
  notes: null,
  status: 'DRAFT',
  customerId: null,
  inputsRevision: 0,
  ...overrides,
});

const arjun: EstimateViewer = { id: ARJUN, role: 'ENGINEER' };
const priya: EstimateViewer = { id: PRIYA, role: 'ENGINEER' };
const lead: EstimateViewer = { id: LEAD, role: 'LEAD' };
const admin: EstimateViewer = { id: ADMIN, role: 'ADMIN' };

function setUp(initial: ReadonlyArray<FakeEstimate> = [estimate()]) {
  const world = createFakeEstimateWorld(() => [{ id: CUSTOMER, name: 'Brightwater Controls', deleted: false }], initial);
  const service = createEstimateService({ estimates: world.repository, audit: createAuditSink().service, nodes: world.nodeRepository, images: world.imageRepository, transactions: world.transactions, ...inputsDependencies() });
  const stored = (): FakeEstimate => {
    const found = world.estimates[0];
    if (found === undefined) throw new Error('no estimate');
    return found;
  };
  return { world, service, stored };
}

const caught = (work: Promise<unknown>): Promise<unknown> => work.catch((error: unknown) => error);

describe('the transitions of the machine, applied to a stored estimate', () => {
  it.each<[string, EstimateStatus, EstimateEvent, EstimateViewer, EstimateStatus]>([
    ['the Engineer Calculates their draft', 'DRAFT', 'CALCULATE', arjun, 'PREPARED'],
    ['a Lead Recalculates a draft (AC-3)', 'DRAFT', 'RECALCULATE', lead, 'PREPARED'],
    ['an Admin Recalculates a draft (AC-3)', 'DRAFT', 'RECALCULATE', admin, 'PREPARED'],
    ['a Lead Recalculates a prepared estimate', 'PREPARED', 'RECALCULATE', lead, 'PREPARED'],
    ['a Lead edits a prepared estimate', 'PREPARED', 'EDIT', lead, 'PREPARED'],
    ['a Lead approves', 'PREPARED', 'APPROVE', lead, 'APPROVED'],
    ['an Admin approves', 'PREPARED', 'APPROVE', admin, 'APPROVED'],
    ['a Lead unlocks (AC-6)', 'APPROVED', 'UNLOCK', lead, 'DRAFT'],
    ['an Admin unlocks', 'APPROVED', 'UNLOCK', admin, 'DRAFT'],
    ['an Admin cancels the approval', 'APPROVED', 'CANCEL', admin, 'DRAFT'],
    ['an Admin cancels the approval kept through an unlock on a Draft (STORY-06.12 AC-10)', 'DRAFT', 'CANCEL', admin, 'DRAFT'],
    ['an Admin cancels the approval kept through an unlock on a Prepared estimate (STORY-06.12 AC-10)', 'PREPARED', 'CANCEL', admin, 'PREPARED'],
    ['a Lead exports an approved estimate', 'APPROVED', 'EXPORT', lead, 'APPROVED'],
  ])('%s', async (_name, status, event, viewer, to) => {
    const { service, stored } = setUp([estimate({ status })]);
    const answer = await service.transition(viewer, ESTIMATE, event);
    expect(answer).toEqual({ id: ESTIMATE, from: status, to });
    expect(stored().status).toBe(to);
  });

  it('a transition that keeps the status writes nothing; one that changes it writes once', async () => {
    const { service, world } = setUp([estimate({ status: 'PREPARED' })]);
    await service.transition(lead, ESTIMATE, 'RECALCULATE');
    await service.transition(lead, ESTIMATE, 'EDIT');
    expect(world.statusWrites()).toBe(0);
    await service.transition(lead, ESTIMATE, 'APPROVE');
    expect(world.statusWrites()).toBe(1);
  });

  it('the status walks one step at a time through the whole cycle and never skips', async () => {
    const { service, stored } = setUp();
    const seen: EstimateStatus[] = [stored().status];
    for (const [viewer, event] of [
      [arjun, 'CALCULATE'],
      [lead, 'APPROVE'],
      [lead, 'UNLOCK'],
      [lead, 'RECALCULATE'],
      [admin, 'APPROVE'],
      [admin, 'CANCEL'],
    ] as const) {
      await service.transition(viewer, ESTIMATE, event);
      seen.push(stored().status);
    }
    expect(seen).toEqual(['DRAFT', 'PREPARED', 'APPROVED', 'DRAFT', 'PREPARED', 'APPROVED', 'DRAFT']);
  });
});

describe('AC-6: unlock leaves the inputs as they were', () => {
  it('sets DRAFT and changes nothing else: the revision stays, so figures that were current stay current', async () => {
    const { service, stored } = setUp([estimate({ status: 'APPROVED', customerId: CUSTOMER, inputsRevision: 7 })]);
    await service.transition(lead, ESTIMATE, 'UNLOCK');
    expect(stored()).toEqual(estimate({ status: 'DRAFT', customerId: CUSTOMER, inputsRevision: 7 }));
  });

  it('the cancel does the same', async () => {
    const { service, stored } = setUp([estimate({ status: 'APPROVED', customerId: CUSTOMER, inputsRevision: 7 })]);
    await service.transition(admin, ESTIMATE, 'CANCEL');
    expect(stored()).toEqual(estimate({ status: 'DRAFT', customerId: CUSTOMER, inputsRevision: 7 }));
  });
});

describe('AC-1: a pair the machine refuses is a 409 with a named reason, and leaves no side effect', () => {
  it.each<[EstimateStatus, EstimateEvent, EstimateViewer, keyof typeof TRANSITION_REFUSALS]>([
    ['DRAFT', 'APPROVE', lead, 'NOT_PREPARED'],
    ['DRAFT', 'UNLOCK', lead, 'NOT_APPROVED'],
    ['DRAFT', 'EXPORT', lead, 'NOT_APPROVED'],
    ['DRAFT', 'EDIT', lead, 'NOT_PREPARED'],
    ['PREPARED', 'CALCULATE', arjun, 'ALREADY_PREPARED'],
    ['PREPARED', 'UNLOCK', lead, 'NOT_APPROVED'],
    ['APPROVED', 'CALCULATE', arjun, 'APPROVED_IS_LOCKED'],
    ['APPROVED', 'RECALCULATE', lead, 'APPROVED_IS_LOCKED'],
    ['APPROVED', 'EDIT', lead, 'APPROVED_IS_LOCKED'],
    ['APPROVED', 'APPROVE', lead, 'ALREADY_APPROVED'],
  ])('%s + %s by %o is refused as %s', async (status, event, viewer, reason) => {
    const { service, stored, world } = setUp([estimate({ status, customerId: CUSTOMER, inputsRevision: 3 })]);
    const refusal = await caught(service.transition(viewer, ESTIMATE, event));
    expect(refusal).toBeInstanceOf(ConflictError);
    expect((refusal as ConflictError).httpStatus).toBe(409);
    expect((refusal as ConflictError).code).toBe(TRANSITION_REFUSALS[reason].code);
    expect((refusal as ConflictError).message).toBe(TRANSITION_REFUSALS[reason].message);
    expect(stored()).toEqual(estimate({ status, customerId: CUSTOMER, inputsRevision: 3 }));
    expect(world.statusWrites()).toBe(0);
  });
});

describe('AC-5: who may transition', () => {
  it("an Engineer on another Engineer's estimate, and on one that does not exist, get the same 404, and nothing changes", async () => {
    const { service, stored } = setUp();
    const notOwn = await caught(service.transition(priya, ESTIMATE, 'CALCULATE'));
    const missing = await caught(service.transition(arjun, '00000000-0000-4000-8000-00000000dead', 'CALCULATE'));
    const malformed = await caught(service.transition(arjun, 'not-an-id', 'CALCULATE'));
    for (const refusal of [notOwn, missing, malformed]) expect(refusal).toBeInstanceOf(NotFoundError);
    expect((notOwn as NotFoundError).message).toBe((missing as NotFoundError).message);
    expect((notOwn as NotFoundError).code).toBe((missing as NotFoundError).code);
    expect(stored().status).toBe('DRAFT');
  });

  it('an Engineer on their own estimate may apply no event but Calculate: any other is the same 404 whatever the status, so nothing is told about it', async () => {
    for (const status of ['DRAFT', 'PREPARED', 'APPROVED'] as const) {
      const { service, stored } = setUp([estimate({ status })]);
      for (const event of ['RECALCULATE', 'EDIT', 'APPROVE', 'UNLOCK', 'CANCEL', 'EXPORT'] as const) {
        const refusal = await caught(service.transition(arjun, ESTIMATE, event));
        expect(refusal).toBeInstanceOf(NotFoundError);
      }
      expect(stored().status).toBe(status);
    }
  });

  it('a Lead who asks for the Admin-only cancel is refused with 403, on an approved estimate and on any other, and nothing changes', async () => {
    for (const status of ['DRAFT', 'PREPARED', 'APPROVED'] as const) {
      const { service, stored } = setUp([estimate({ status })]);
      const refusal = await caught(service.transition(lead, ESTIMATE, 'CANCEL'));
      expect(refusal).toBeInstanceOf(ForbiddenError);
      expect((refusal as ForbiddenError).httpStatus).toBe(403);
      expect(stored().status).toBe(status);
    }
  });

  it('a Lead and an Admin may transition any estimate, whoever it is assigned to', async () => {
    const { service } = setUp();
    await expect(service.transition(lead, ESTIMATE, 'RECALCULATE')).resolves.toMatchObject({ to: 'PREPARED' });
    await expect(service.transition(admin, ESTIMATE, 'APPROVE')).resolves.toMatchObject({ to: 'APPROVED' });
  });

  it('the refusal of an event by role is made before the status is read: a Lead is not told whether an estimate is approved by the Admin-only cancel', async () => {
    const a = setUp([estimate({ status: 'DRAFT' })]);
    const b = setUp([estimate({ status: 'APPROVED' })]);
    const first = await caught(a.service.transition(lead, ESTIMATE, 'CANCEL'));
    const second = await caught(b.service.transition(lead, ESTIMATE, 'CANCEL'));
    expect((first as ForbiddenError).code).toBe((second as ForbiddenError).code);
    expect((first as ForbiddenError).message).toBe((second as ForbiddenError).message);
  });
});

describe('AC-4: two transitions at once are serialised', () => {
  it('two Calculates: one wins, the other is 409 ALREADY_PREPARED, and the status is PREPARED, never further', async () => {
    const { service, stored, world } = setUp();
    const results = await Promise.allSettled([service.transition(arjun, ESTIMATE, 'CALCULATE'), service.transition(arjun, ESTIMATE, 'CALCULATE')]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(ConflictError);
    expect((rejected?.reason as ConflictError).code).toBe('ESTIMATE_ALREADY_PREPARED');
    expect(stored().status).toBe('PREPARED');
    expect(world.statusWrites()).toBe(1);
  });

  it('two approvals: one wins, the other is 409 ALREADY_APPROVED', async () => {
    const { service, stored } = setUp([estimate({ status: 'PREPARED' })]);
    const results = await Promise.allSettled([service.transition(lead, ESTIMATE, 'APPROVE'), service.transition(admin, ESTIMATE, 'APPROVE')]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(stored().status).toBe('APPROVED');
  });

  // Since STORY-06.12 AC-10 a CANCEL on a Draft is allowed (the status stays), so the pair that must lose is two events that need APPROVED: two unlocks.
  it('two unlocks at once: one wins, the other is 409 NOT_APPROVED, because the status is already DRAFT', async () => {
    const { service, stored } = setUp([estimate({ status: 'APPROVED' })]);
    const results = await Promise.allSettled([service.transition(lead, ESTIMATE, 'UNLOCK'), service.transition(admin, ESTIMATE, 'UNLOCK')]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect((rejected?.reason as ConflictError).code).toBe('ESTIMATE_NOT_APPROVED');
    expect(stored().status).toBe('DRAFT');
  });

  it('an approval and a customer change at once: the change that comes second sees the status the first left, so no input changes after approval', async () => {
    const { service, stored } = setUp([estimate({ status: 'PREPARED' })]);
    const results = await Promise.allSettled([service.transition(lead, ESTIMATE, 'APPROVE'), service.setCustomer(lead, changeContext(lead), ESTIMATE, CUSTOMER)]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect(stored().status).toBe('APPROVED');
    expect(stored().customerId).toBeNull();
  });

  it('a transaction that fails after the status was written puts the status back, and the next one still runs', async () => {
    const { world, service, stored } = setUp([estimate({ status: 'PREPARED' })]);
    await expect(
      world.transactions.run(async (tx) => {
        await world.repository.setStatus(ESTIMATE, 'PREPARED', 'APPROVED', tx);
        throw new Error('the work failed after the write');
      }),
    ).rejects.toThrow('the work failed after the write');
    expect(stored().status).toBe('PREPARED');
    await expect(service.transition(lead, ESTIMATE, 'APPROVE')).resolves.toMatchObject({ to: 'APPROVED' });
  });

  it('a status that changed since it was read is not overwritten: the conditional write answers false and the transition is a 409', async () => {
    const { world, service, stored } = setUp([estimate({ status: 'PREPARED' })]);
    // The estimate is read as PREPARED, then another connection that skipped the lock moves it before this write.
    const lockEstimate = world.repository.lockEstimate.bind(world.repository);
    world.repository.lockEstimate = async (id, tx) => {
      const locked = await lockEstimate(id, tx);
      stored().status = 'APPROVED';
      return locked;
    };
    const refusal = await caught(service.transition(lead, ESTIMATE, 'APPROVE'));
    expect(refusal).toBeInstanceOf(ConflictError);
    expect((refusal as ConflictError).code).toBe('ESTIMATE_STATUS_CHANGED');
    // The write that found another status wrote nothing (the fake's rollback also undoes the outside move, which a real commit would not).
    expect(world.statusWrites()).toBe(0);
  });
});

describe('AC-2: assertEditable, the one check every input write shares', () => {
  it.each<[EstimateStatus, EstimateViewer]>([
    ['PREPARED', arjun],
    ['APPROVED', arjun],
    ['APPROVED', lead],
    ['APPROVED', admin],
  ])('a %s estimate is refused for %o with 409 ESTIMATE_NOT_EDITABLE and the words of the form', (status, viewer) => {
    let refusal: unknown;
    try {
      assertEditable(viewer, { status, ignoredAt: null });
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toBeInstanceOf(ConflictError);
    expect((refusal as ConflictError).httpStatus).toBe(409);
    expect((refusal as ConflictError).code).toBe(ESTIMATE_NOT_EDITABLE_CODE);
    expect((refusal as ConflictError).message).toBe(NOT_EDITABLE_MESSAGE);
  });

  it.each<[EstimateStatus, EstimateViewer]>([
    ['DRAFT', arjun],
    ['DRAFT', lead],
    ['DRAFT', admin],
    ['PREPARED', lead],
    ['PREPARED', admin],
  ])('a %s estimate may be changed by %o', (status, viewer) => {
    expect(() => assertEditable(viewer, { status, ignoredAt: null })).not.toThrow();
  });
});

describe('AC-2: the customer is an input, so setCustomer follows the same rule', () => {
  it.each(['DRAFT', 'PREPARED', 'APPROVED'] as const)('the Engineer cannot change the customer of a %s estimate (CR-01 item 6, a Lead and an Admin set it): 403, and the estimate is as it was', async (status) => {
    const { service, stored } = setUp([estimate({ status, inputsRevision: 2 })]);
    const refusal = await caught(service.setCustomer(arjun, changeContext(arjun), ESTIMATE, CUSTOMER));
    expect(refusal).toBeInstanceOf(ForbiddenError);
    expect((refusal as ForbiddenError).httpStatus).toBe(403);
    expect(stored().customerId).toBeNull();
    expect(stored().inputsRevision).toBe(2);
  });

  it('a Lead may change the customer of a prepared estimate (FR-064), which raises the revision, and nobody may on an approved one', async () => {
    const { service, stored } = setUp([estimate({ status: 'PREPARED', inputsRevision: 2 })]);
    await service.setCustomer(lead, changeContext(lead), ESTIMATE, CUSTOMER);
    expect(stored().customerId).toBe(CUSTOMER);
    expect(stored().inputsRevision).toBe(3);
    stored().status = 'APPROVED';
    await expect(service.setCustomer(admin, changeContext(admin), ESTIMATE, CUSTOMER)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('SQR-01: transition joins the transaction its caller gives it', () => {
  /** A runner that counts the transactions opened and refuses one opened inside another, which is what PostgreSQL answers with a wait on its own row lock. */
  function strictRunner(inner: TransactionRunner) {
    let open = 0;
    let opened = 0;
    const runner: TransactionRunner = {
      run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
        if (open > 0) return Promise.reject(new Error('A transaction was opened inside another.'));
        open += 1;
        opened += 1;
        return inner.run(work).finally(() => {
          open -= 1;
        });
      },
    };
    return { runner, opened: () => opened };
  }

  function setUpStrict(initial: ReadonlyArray<FakeEstimate>) {
    const world = createFakeEstimateWorld(() => [{ id: CUSTOMER, name: 'Brightwater Controls', deleted: false }], initial);
    const strict = strictRunner(world.transactions);
    const service = createEstimateService({ estimates: world.repository, audit: createAuditSink().service, nodes: world.nodeRepository, images: world.imageRepository, transactions: strict.runner, ...inputsDependencies() });
    const stored = (): FakeEstimate => {
      const found = world.estimates[0];
      if (found === undefined) throw new Error('no estimate');
      return found;
    };
    return { world, strict, service, stored };
  }

  it('without tx it opens exactly one transaction of its own', async () => {
    const { strict, service, stored } = setUpStrict([estimate({ status: 'PREPARED' })]);
    await service.transition(lead, ESTIMATE, 'APPROVE');
    expect(strict.opened()).toBe(1);
    expect(stored().status).toBe('APPROVED');
  });

  it("with tx it opens none: the caller's transaction is the only one, and the status is written in it", async () => {
    const { strict, service, stored } = setUpStrict([estimate({ status: 'PREPARED' })]);
    const answer = await strict.runner.run((tx) => service.transition(lead, ESTIMATE, 'APPROVE', tx));
    expect(answer).toEqual({ id: ESTIMATE, from: 'PREPARED', to: 'APPROVED' });
    expect(strict.opened()).toBe(1);
    expect(stored().status).toBe('APPROVED');
  });

  it('a nested transaction is caught by the strict runner, so a transition that opened its own inside its caller\'s would fail these tests', async () => {
    const { strict } = setUpStrict([estimate({ status: 'PREPARED' })]);
    await expect(strict.runner.run(() => strict.runner.run(() => Promise.resolve()))).rejects.toThrow('inside another');
  });

  it("a failure after the transition, in the caller's transaction, puts the status back: the status and the caller's own write are one unit", async () => {
    const { strict, service, world, stored } = setUpStrict([estimate({ status: 'PREPARED' })]);
    await expect(
      strict.runner.run(async (tx) => {
        await service.transition(lead, ESTIMATE, 'APPROVE', tx);
        expect(stored().status).toBe('APPROVED');
        throw new Error("the caller's own write failed");
      }),
    ).rejects.toThrow("the caller's own write failed");
    expect(stored().status).toBe('PREPARED');
    expect(world.statusWrites()).toBe(1);
    // The estimate is free again: the next transition runs.
    await expect(service.transition(lead, ESTIMATE, 'APPROVE')).resolves.toMatchObject({ to: 'APPROVED' });
  });

  it("a refusal inside the caller's transaction is the same error as outside it, and writes nothing", async () => {
    const { strict, service, stored } = setUpStrict([estimate({ status: 'APPROVED' })]);
    const refusal = await caught(strict.runner.run((tx) => service.transition(lead, ESTIMATE, 'APPROVE', tx)));
    expect(refusal).toBeInstanceOf(ConflictError);
    expect((refusal as ConflictError).code).toBe(TRANSITION_REFUSALS.ALREADY_APPROVED.code);
    expect(stored().status).toBe('APPROVED');
    const stranger = await caught(strict.runner.run((tx) => service.transition(priya, ESTIMATE, 'CALCULATE', tx)));
    expect(stranger).toBeInstanceOf(NotFoundError);
  });
});

describe('AQP-399 (CR-01 item 7B): Quoted and the Ignored layer, applied to a stored estimate', () => {
  it.each([
    ['a Lead', lead, LEAD],
    ['an Admin', admin, ADMIN],
  ] as const)('%s marks an approved estimate as quoted: the status moves and the person is recorded with it, in one write', async (_name, viewer, personId) => {
    const { service, stored, world } = setUp([estimate({ status: 'APPROVED' })]);
    expect(await service.transition(viewer, ESTIMATE, 'MARK_QUOTED')).toEqual({ id: ESTIMATE, from: 'APPROVED', to: 'QUOTED' });
    expect(stored()).toMatchObject({ status: 'QUOTED', quotedBy: personId });
    expect(world.statusWrites()).toBe(1);
  });

  it('an Engineer marking as quoted is the same 404 on their own estimate whatever its status, and nothing changes', async () => {
    for (const status of ['DRAFT', 'PREPARED', 'APPROVED', 'QUOTED'] as const) {
      const { service, stored } = setUp([estimate({ status })]);
      expect(await caught(service.transition(arjun, ESTIMATE, 'MARK_QUOTED'))).toBeInstanceOf(NotFoundError);
      expect(stored().status).toBe(status);
    }
  });

  it.each<[EstimateStatus, keyof typeof TRANSITION_REFUSALS]>([
    ['DRAFT', 'NOT_APPROVED'],
    ['PREPARED', 'NOT_APPROVED'],
    ['QUOTED', 'ALREADY_QUOTED'],
  ])('marking a %s estimate as quoted is refused as %s, and the estimate is as it was', async (status, reason) => {
    const { service, stored, world } = setUp([estimate({ status })]);
    const refusal = await caught(service.transition(lead, ESTIMATE, 'MARK_QUOTED'));
    expect(refusal).toBeInstanceOf(ConflictError);
    expect((refusal as ConflictError).code).toBe(TRANSITION_REFUSALS[reason].code);
    expect(stored()).toEqual(estimate({ status }));
    expect(world.statusWrites()).toBe(0);
  });

  it.each([
    ['UNLOCK', lead],
    ['UNLOCK', admin],
    ['CANCEL', admin],
  ] as const)('%s by a %o takes a quoted estimate to DRAFT and the quote marker goes with it, in the same write (A-CR01-1)', async (event, viewer) => {
    const { service, stored, world } = setUp([estimate({ status: 'APPROVED' })]);
    await service.transition(lead, ESTIMATE, 'MARK_QUOTED');
    expect(stored().quotedBy).toBe(LEAD);
    expect(await service.transition(viewer, ESTIMATE, event)).toEqual({ id: ESTIMATE, from: 'QUOTED', to: 'DRAFT' });
    expect(stored()).toEqual(estimate({ status: 'DRAFT' }));
    expect(world.statusWrites()).toBe(2);
  });

  it('a quoted estimate refuses Calculate, Recalculate, Edit and Approve with the locked words of an approved one (AC-4), and Export leaves it QUOTED', async () => {
    for (const [event, viewer] of [['CALCULATE', arjun], ['RECALCULATE', lead], ['EDIT', lead], ['APPROVE', lead]] as const) {
      const { service, stored, world } = setUp([estimate({ status: 'QUOTED', quotedBy: LEAD })]);
      const refusal = await caught(service.transition(viewer, ESTIMATE, event));
      // An Engineer's Calculate on their own task is a refusal of state; every other event of theirs is the 404 of the role, so the Engineer is told nothing but what Calculate says.
      expect(refusal, event).toBeInstanceOf(ConflictError);
      expect((refusal as ConflictError).code).toBe(TRANSITION_REFUSALS.APPROVED_IS_LOCKED.code);
      expect((refusal as ConflictError).message).toBe(TRANSITION_REFUSALS.APPROVED_IS_LOCKED.message);
      expect(stored().status).toBe('QUOTED');
      expect(world.statusWrites()).toBe(0);
    }
    const { service, stored } = setUp([estimate({ status: 'QUOTED', quotedBy: LEAD })]);
    expect(await service.transition(lead, ESTIMATE, 'EXPORT')).toEqual({ id: ESTIMATE, from: 'QUOTED', to: 'QUOTED' });
    expect(stored()).toMatchObject({ status: 'QUOTED', quotedBy: LEAD });
  });

  it.each(['DRAFT', 'PREPARED', 'APPROVED'] as const)('an ignored %s estimate refuses every event with ESTIMATE_IGNORED, Export included, and nothing changes', async (status) => {
    const ignoredAt = new Date('2026-11-23T10:00:00.000Z');
    for (const [event, viewer] of [['CALCULATE', arjun], ['RECALCULATE', lead], ['EDIT', lead], ['APPROVE', lead], ['UNLOCK', lead], ['CANCEL', admin], ['EXPORT', lead], ['MARK_QUOTED', lead]] as const) {
      const { service, stored, world } = setUp([estimate({ status, ignoredAt })]);
      const refusal = await caught(service.transition(viewer, ESTIMATE, event));
      expect(refusal, `${status} ${event}`).toBeInstanceOf(ConflictError);
      expect((refusal as ConflictError).code).toBe('ESTIMATE_IGNORED');
      expect((refusal as ConflictError).message).toBe('This estimate is ignored. Restore it first.');
      expect(stored()).toEqual(estimate({ status, ignoredAt }));
      expect(world.statusWrites()).toBe(0);
    }
  });

  it('Ignore and Restore are allowed by the machine, but the status transition does not write the layer, so it refuses to report them as done (story 7D writes them)', async () => {
    for (const [event, ignoredAt] of [['IGNORE', null], ['RESTORE', new Date('2026-11-23T10:00:00.000Z')]] as const) {
      const { service, stored, world } = setUp([estimate({ status: 'PREPARED', ignoredAt })]);
      const failure = await caught(service.transition(lead, ESTIMATE, event));
      expect(failure).toBeInstanceOf(Error);
      expect(failure).not.toBeInstanceOf(ConflictError);
      expect((failure as Error).message).toBe('Ignore and Restore are not written by the status transition.');
      expect(stored()).toEqual(estimate({ status: 'PREPARED', ignoredAt }));
      expect(world.statusWrites()).toBe(0);
    }
  });

  it('assertEditable refuses a quoted estimate for everyone with the words of the form, and an ignored one with its own code, whatever the status underneath', () => {
    const refused = (viewer: EstimateViewer, status: EstimateStatus, ignoredAt: Date | null): ConflictError => {
      try {
        assertEditable(viewer, { status, ignoredAt });
      } catch (error) {
        return error as ConflictError;
      }
      throw new Error('assertEditable should have refused.');
    };
    for (const viewer of [arjun, lead, admin]) {
      expect(refused(viewer, 'QUOTED', null)).toMatchObject({ httpStatus: 409, code: ESTIMATE_NOT_EDITABLE_CODE, message: NOT_EDITABLE_MESSAGE });
      for (const status of ['DRAFT', 'PREPARED', 'APPROVED'] as const) {
        expect(refused(viewer, status, new Date('2026-11-23T10:00:00.000Z'))).toMatchObject({ httpStatus: 409, code: 'ESTIMATE_IGNORED', message: 'This estimate is ignored. Restore it first.' });
      }
    }
  });
});
