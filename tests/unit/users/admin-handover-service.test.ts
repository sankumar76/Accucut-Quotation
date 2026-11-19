import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActiveAdminExistsError, ForbiddenError, NotFoundError, StepUpFailed, StepUpLocked } from '@/lib/errors';
import {
  CANNOT_HAND_OVER_TO_SELF_CODE,
  CANNOT_HAND_OVER_TO_SELF_MESSAGE,
  HAND_OVER_TARGET_INACTIVE_CODE,
  HAND_OVER_TARGET_INACTIVE_MESSAGE,
} from '@/lib/users/hand-over';
import type { Transaction, TransactionRunner } from '@/server/repositories/transaction';
import { UserConstraintError, type UserAccount, type UserRepository } from '@/server/repositories/user-repository';
import { createAdminHandoverService, type AdminHandoverService } from '@/server/services/admin-handover-service';
import { createAuditService } from '@/server/services/audit-service';

import { defined } from '../../support/defined';
import type { FakeUserRepository } from '../../support/fake-auth-repositories';
import { createUserServiceFixture, refusal, REQUEST_ID, type UserServiceFixture } from '../../support/user-service-fixture';

/**
 * STORY-01.09 (AC-2 to AC-5, AC-7 at the level of the rules, AC-9): the Admin hand-over over in-memory people and an in-memory audit log. What only PostgreSQL can show (the
 * partial unique index, the row locks, the overlap of two requests, the rolled-back transaction) is `tests/integration/users/admin-handover.test.ts`. Every name and
 * password is invented.
 */

const PASSWORD = 'invented-admin-password-for-the-handover-1';

let fixture: UserServiceFixture;
let users: FakeUserRepository;
let service: AdminHandoverService;
let adminId: string;
let leadId: string;
let engineerId: string;
let verifyStepUp: ReturnType<typeof vi.fn<(caller: { user: { id: string }; requestId: string }, password: string) => Promise<void>>>;
let transactionsOpened: number;
let lockedInOrder: string[];

/** The users repository seen through a spy on the locking read, so the order of the two locks is observable. */
function watching(repository: FakeUserRepository): UserRepository {
  return {
    ...repository,
    findAccountForUpdate(id: string, tx: Transaction): Promise<UserAccount | null> {
      lockedInOrder.push(id.toLowerCase());
      return repository.findAccountForUpdate(id, tx);
    },
    handOverAdmin: (handOver, tx) => repository.handOverAdmin(handOver, tx),
  };
}

function build(repository: UserRepository = watching(users)): AdminHandoverService {
  const real = fixture.world.transactions;
  const counting: TransactionRunner = {
    run(work) {
      transactionsOpened += 1;
      return real.run(work);
    },
  };
  return createAdminHandoverService({ users: repository, transactions: counting, audit: createAuditService({ audit: fixture.world.audit }), stepUp: { verifyStepUp } });
}

const by = (actorId: string) => fixture.by(actorId);

beforeEach(() => {
  fixture = createUserServiceFixture();
  ({ users, adminId, leadId, engineerId } = fixture);
  verifyStepUp = vi.fn(() => Promise.resolve());
  transactionsOpened = 0;
  lockedInOrder = [];
  service = build();
});

function stateOf(id: string) {
  return defined(users.records.find((record) => record.id === id));
}

describe('AC-2: the password is checked first, by the step-up, for the signed-in person and nobody else', () => {
  it('asks verifyStepUp with the caller (never the target) and the request ID, before a transaction is opened or a row is read', async () => {
    let seenBefore: { opened: number; locked: number } | undefined;
    verifyStepUp.mockImplementationOnce(() => {
      seenBefore = { opened: transactionsOpened, locked: lockedInOrder.length };
      return Promise.resolve();
    });
    await service.handOver(by(adminId), leadId, PASSWORD);
    expect(verifyStepUp).toHaveBeenCalledTimes(1);
    expect(verifyStepUp).toHaveBeenCalledWith({ user: { id: adminId }, requestId: REQUEST_ID }, PASSWORD);
    expect(seenBefore).toEqual({ opened: 0, locked: 0 });
  });

  it.each([
    ['wrong', new StepUpFailed('That password is not correct.')],
    ['blocked', new StepUpLocked('Too many wrong passwords. Try again in 15 minutes.')],
  ])('a %s password ends the request before anything is read, locked or written', async (_name, failure) => {
    verifyStepUp.mockRejectedValueOnce(failure);
    expect(await refusal(service.handOver(by(adminId), leadId, PASSWORD))).toBe(failure);
    expect(transactionsOpened).toBe(0);
    expect(lockedInOrder).toEqual([]);
    expect(stateOf(adminId).role).toBe('ADMIN');
    expect(stateOf(leadId).role).toBe('LEAD');
    expect(fixture.world.audit.appended).toEqual([]);
  });

  it('a target that is the caller is refused only after the password was checked (the order of AC-5)', async () => {
    verifyStepUp.mockRejectedValueOnce(new StepUpFailed('That password is not correct.'));
    expect(await refusal(service.handOver(by(adminId), adminId, PASSWORD))).toBeInstanceOf(StepUpFailed);
  });
});

describe('AC-3: the swap', () => {
  it.each([
    ['a Lead', () => leadId],
    ['an Engineer', () => engineerId],
  ])('hands the role to %s: they become the Admin, the old Admin becomes a Lead, and both sessions are ended', async (_name, targetOf) => {
    const target = targetOf();
    const before = { admin: stateOf(adminId).sessionVersion, target: stateOf(target).sessionVersion };
    await service.handOver(by(adminId), target, PASSWORD);
    expect(stateOf(adminId)).toMatchObject({ role: 'LEAD', isActive: true, sessionVersion: before.admin + 1 });
    expect(stateOf(target)).toMatchObject({ role: 'ADMIN', isActive: true, sessionVersion: before.target + 1 });
    expect(users.records.filter((record) => record.role === 'ADMIN' && record.isActive)).toHaveLength(1);
    // The people nobody handed anything to are not touched.
    const bystander = target === leadId ? engineerId : leadId;
    expect(stateOf(bystander).sessionVersion).toBe(0);
  });

  it('opens one transaction and locks both rows in ascending ID order, whichever of the two is lower', async () => {
    await service.handOver(by(adminId), engineerId, PASSWORD);
    expect(transactionsOpened).toBe(1);
    expect(lockedInOrder).toEqual([adminId, engineerId]);
  });

  it("the order is the IDs', not who asked: when the target has the lower ID it is locked first", async () => {
    // The Lead holds the role now and has the higher ID; the person with the lower ID (the former Admin, now a Lead) is the target.
    stateOf(adminId).role = 'LEAD';
    stateOf(leadId).role = 'ADMIN';
    await service.handOver(by(leadId), adminId, PASSWORD);
    expect(lockedInOrder).toEqual([adminId, leadId]);
    expect(stateOf(adminId).role).toBe('ADMIN');
  });

  it('compares IDs without regard to letter case: the target written in capitals is the same row', async () => {
    await service.handOver(by(adminId.toUpperCase()), leadId.toUpperCase(), PASSWORD);
    expect(stateOf(leadId).role).toBe('ADMIN');
  });

  it('does not touch a password or the "must change" flag (the hand-over sets no password)', async () => {
    const hashBefore = stateOf(leadId).passwordHash;
    await service.handOver(by(adminId), leadId, PASSWORD);
    expect(stateOf(leadId)).toMatchObject({ passwordHash: hashBefore, mustChangePassword: false });
  });
});

describe('AC-4: exactly one audit entry', () => {
  it('writes user.admin_handed_over once, with the two people by ID and name at the time, the old Admin as the actor, and nothing else', async () => {
    await service.handOver(by(adminId), leadId, PASSWORD);
    expect(fixture.world.audit.appended).toEqual([
      {
        actorId: adminId,
        actorLabel: 'Invented Admin',
        event: 'user.admin_handed_over',
        objectType: 'user',
        objectId: leadId,
        objectLabel: 'Invented Lead',
        before: { adminId, adminName: 'Invented Admin' },
        after: { adminId: leadId, adminName: 'Invented Lead' },
        requestId: REQUEST_ID,
      },
    ]);
    // One entry for the act: not a role change for each person.
    expect(fixture.world.audit.appended.map((entry) => entry.event)).not.toContain('user.role_changed');
  });

  it('the entry and the transaction are one: the entry is kept only because the transaction committed', async () => {
    await service.handOver(by(adminId), leadId, PASSWORD);
    expect(fixture.world.audit.committed).toHaveLength(1);
  });

  it('a refused entry rolls the entry back, and the service does not hide the refusal', async () => {
    const failure = new Error('invented audit failure');
    const failing = createAdminHandoverService({
      users: watching(users),
      transactions: fixture.world.transactions,
      audit: { record: () => Promise.reject(failure) },
      stepUp: { verifyStepUp },
    });
    expect(await refusal(failing.handOver(by(adminId), leadId, PASSWORD))).toBe(failure);
    expect(fixture.world.audit.committed).toEqual([]);
  });
});

describe('AC-5: refusals, in the order the story fixes', () => {
  it('a target that is the caller: 409 CANNOT_HAND_OVER_TO_SELF, nothing locked, nothing changed (also in capitals)', async () => {
    for (const written of [adminId, adminId.toUpperCase()]) {
      expect(await refusal(service.handOver(by(adminId), written, PASSWORD))).toMatchObject({
        httpStatus: 409,
        code: CANNOT_HAND_OVER_TO_SELF_CODE,
        message: CANNOT_HAND_OVER_TO_SELF_MESSAGE,
      });
    }
    expect(transactionsOpened).toBe(0);
    expect(stateOf(adminId)).toMatchObject({ role: 'ADMIN', sessionVersion: 0 });
    expect(fixture.world.audit.appended).toEqual([]);
  });

  it('a deactivated target: 409 HAND_OVER_TARGET_INACTIVE, and the Admin stays the Admin', async () => {
    stateOf(engineerId).isActive = false;
    expect(await refusal(service.handOver(by(adminId), engineerId, PASSWORD))).toMatchObject({
      httpStatus: 409,
      code: HAND_OVER_TARGET_INACTIVE_CODE,
      message: HAND_OVER_TARGET_INACTIVE_MESSAGE,
    });
    expect(stateOf(adminId)).toMatchObject({ role: 'ADMIN', sessionVersion: 0 });
    expect(stateOf(engineerId)).toMatchObject({ role: 'ENGINEER', sessionVersion: 0 });
    expect(fixture.world.audit.appended).toEqual([]);
  });

  it('an unknown ID: 404, nothing changed', async () => {
    expect(await refusal(service.handOver(by(adminId), '00000000-0000-4000-8000-0000000000ff', PASSWORD))).toBeInstanceOf(NotFoundError);
    expect(stateOf(adminId).role).toBe('ADMIN');
    expect(fixture.world.audit.appended).toEqual([]);
  });

  it('a caller who is no longer the active Admin (another hand-over won) is refused 403 and nothing changes', async () => {
    stateOf(adminId).role = 'LEAD';
    stateOf(leadId).role = 'ADMIN';
    expect(await refusal(service.handOver(by(adminId), engineerId, PASSWORD))).toBeInstanceOf(ForbiddenError);
    expect(stateOf(leadId).role).toBe('ADMIN');
    expect(stateOf(engineerId).role).toBe('ENGINEER');
    expect(fixture.world.audit.appended).toEqual([]);
  });

  it('a caller who was deactivated meanwhile is refused 403 too', async () => {
    stateOf(adminId).isActive = false;
    expect(await refusal(service.handOver(by(adminId), leadId, PASSWORD))).toBeInstanceOf(ForbiddenError);
  });

  it('the database refusing a second Admin (the index) is the one-Admin answer, naming who holds the place', async () => {
    const raced: UserRepository = {
      ...watching(users),
      handOverAdmin: () => Promise.reject(new UserConstraintError('single-active-admin', { cause: new Error('fake') })),
    };
    const refused = await refusal(build(raced).handOver(by(adminId), leadId, PASSWORD));
    expect(refused).toBeInstanceOf(ActiveAdminExistsError);
    expect(refused).toMatchObject({ httpStatus: 409, currentAdmin: { id: adminId } });
  });

  it('a swap the repository could not make (no row matched) is a fault, not a success: the transaction is rolled back', async () => {
    const stale: UserRepository = { ...watching(users), handOverAdmin: () => Promise.resolve(false) };
    const refused = await refusal(build(stale).handOver(by(adminId), leadId, PASSWORD));
    expect(refused).toBeInstanceOf(Error);
    expect(fixture.world.audit.committed).toEqual([]);
  });
});

describe('AC-9: the password goes to the step-up and nowhere else', () => {
  it('is in no audit entry and no refusal', async () => {
    await service.handOver(by(adminId), leadId, PASSWORD);
    expect(JSON.stringify(fixture.world.audit.appended)).not.toContain(PASSWORD);
    const refusals = [
      await refusal(service.handOver(by(adminId), adminId, PASSWORD)),
      await refusal(service.handOver(by(leadId), '00000000-0000-4000-8000-0000000000ff', PASSWORD)),
    ];
    for (const refused of refusals) expect(JSON.stringify(refused, Object.getOwnPropertyNames(refused))).not.toContain(PASSWORD);
  });

});
