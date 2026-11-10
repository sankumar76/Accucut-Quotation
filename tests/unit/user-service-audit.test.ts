import { beforeEach, describe, expect, it } from 'vitest';

import { accountThrottleKey } from '@/server/auth/throttle-key';
import { createUserService, type UserService } from '@/server/services/user-service';

import { defined } from '../support/defined';
import type { CountingHasher, FakeThrottleRepository, FakeUserRepository } from '../support/fake-auth-repositories';
import type { FakeAuditWorld } from '../support/fake-audit';
import { createUserServiceFixture, KEY_SECRET, refusal, REQUEST_ID, type UserServiceFixture } from '../support/user-service-fixture';

/**
 * STORY-01.07 T3 (AC-2, AC-3, AC-4, AC-5) at the level of the rules: each user change is one transaction with its audit
 * entries, six events, one for each attribute that changed, over an in-memory audit log. The same entries are checked in
 * PostgreSQL, rolled back and committed, in tests/integration/audit. The world is `tests/support/user-service-fixture.ts`.
 * Every name and address is invented.
 */

let users: FakeUserRepository;
let throttles: FakeThrottleRepository;
let hasher: CountingHasher;
let world: FakeAuditWorld;
let service: UserService;
let by: UserServiceFixture['by'];
let adminId: string;
let engineerId: string;

beforeEach(() => {
  ({ users, throttles, hasher, world, service, by, adminId, engineerId } = createUserServiceFixture());
});

describe('AC-3: each change raises its event, once, with every part, in the same transaction', () => {
  const FIRST_PASSWORD = 'first-password-1';

  it('adding a person raises user.created: who and their name, the person and their name at the time, no before, the role and active after, the request', async () => {
    const created = await service.create(by(adminId), { name: 'Rohan Das', email: 'rohan.das@example.test', role: 'ENGINEER', password: FIRST_PASSWORD });
    expect(world.audit.committed).toHaveLength(1);
    expect(world.audit.appended[0]).toEqual({
      actorId: adminId,
      actorLabel: 'Invented Admin',
      event: 'user.created',
      objectType: 'user',
      objectId: created.id,
      objectLabel: 'Rohan Das',
      before: null,
      after: { role: 'ENGINEER', isActive: true },
      requestId: REQUEST_ID,
    });
    expect(world.audit.committed[0]).toMatchObject({ actorId: adminId, actorLabel: 'Invented Admin', createdAt: expect.any(Date) });
  });

  it('changing a name raises user.renamed with the old and the new name, under the new name', async () => {
    await service.update(by(adminId), engineerId, { name: 'Renamed Engineer' });
    expect(world.audit.appended).toEqual([
      expect.objectContaining({ event: 'user.renamed', objectId: engineerId, objectLabel: 'Renamed Engineer', before: { name: 'Invented Engineer' }, after: { name: 'Renamed Engineer' }, actorId: adminId, requestId: REQUEST_ID }),
    ]);
  });

  it('changing a role raises user.role_changed with the role before and after', async () => {
    await service.update(by(adminId), engineerId, { role: 'LEAD' });
    expect(world.audit.appended).toEqual([
      expect.objectContaining({ event: 'user.role_changed', objectId: engineerId, objectLabel: 'Invented Engineer', before: { role: 'ENGINEER' }, after: { role: 'LEAD' }, actorId: adminId, requestId: REQUEST_ID }),
    ]);
  });

  it('deactivating raises user.deactivated and activating raises user.activated', async () => {
    await service.update(by(adminId), engineerId, { isActive: false });
    await service.update(by(adminId), engineerId, { isActive: true });
    expect(world.audit.appended.map((row) => [row.event, row.before, row.after])).toEqual([
      ['user.deactivated', { isActive: true }, { isActive: false }],
      ['user.activated', { isActive: false }, { isActive: true }],
    ]);
  });

  it('resetting a password raises user.password_reset with whether a change was still due, before and after', async () => {
    await service.resetPassword(by(adminId), engineerId, 'temporary-password-1');
    expect(world.audit.appended).toEqual([
      expect.objectContaining({ event: 'user.password_reset', objectId: engineerId, before: { mustChangePassword: false }, after: { mustChangePassword: true } }),
    ]);
  });

  it('a save that changes the name, the role and the active flag raises one event for each, in that order, all under the new name', async () => {
    await service.update(by(adminId), engineerId, { name: 'Renamed Engineer', role: 'LEAD', isActive: false });
    expect(world.audit.committed.map((row) => [row.event, row.objectLabel])).toEqual([
      ['user.renamed', 'Renamed Engineer'],
      ['user.role_changed', 'Renamed Engineer'],
      ['user.deactivated', 'Renamed Engineer'],
    ]);
    expect(new Set(world.audit.committed.map((row) => row.id)).size).toBe(3);
  });

  it('a name plus a role writes two entries; the name alone writes one', async () => {
    await service.update(by(adminId), engineerId, { name: 'Renamed Engineer', role: 'LEAD' });
    expect(world.audit.committed.map((row) => row.event)).toEqual(['user.renamed', 'user.role_changed']);
    await service.update(by(adminId), engineerId, { name: 'Renamed Again' });
    expect(world.audit.committed.map((row) => row.event)).toEqual(['user.renamed', 'user.role_changed', 'user.renamed']);
  });

  it('changes that change nothing raise nothing: the same name, the same role, the same flag', async () => {
    await service.update(by(adminId), engineerId, { name: 'Invented Engineer' });
    await service.update(by(adminId), engineerId, { role: 'ENGINEER' });
    await service.update(by(adminId), engineerId, { isActive: true });
    await service.update(by(adminId), engineerId, { name: 'Invented Engineer', role: 'ENGINEER', isActive: true });
    expect(world.audit.committed).toEqual([]);
  });

  it('a self-rename: Who is the name the signed-in user had, Object the name they have now', async () => {
    await service.update(by(adminId), adminId, { name: 'Renamed Admin' });
    expect(world.audit.appended).toEqual([
      expect.objectContaining({ event: 'user.renamed', actorId: adminId, actorLabel: 'Invented Admin', objectId: adminId, objectLabel: 'Renamed Admin' }),
    ]);
  });

  it('a change that is refused raises nothing: a second Admin, the own role, the own account, an unknown person', async () => {
    await refusal(service.create(by(adminId), { name: 'Second Admin', email: 'second@example.test', role: 'ADMIN', password: FIRST_PASSWORD }));
    await refusal(service.update(by(adminId), adminId, { role: 'LEAD' }));
    await refusal(service.update(by(adminId), adminId, { isActive: false }));
    await refusal(service.resetPassword(by(adminId), adminId, 'temporary-password-1'));
    await refusal(service.update(by(adminId), '00000000-0000-4000-8000-0000000000ff', { role: 'LEAD' }));
    expect(world.audit.committed).toEqual([]);
  });

  it('a change whose entry is refused does not leave an entry behind, and the caller sees the refusal', async () => {
    const broken = new Error('the audit write failed');
    const failing = createUserService({
      users,
      throttles,
      hasher,
      transactions: world.transactions,
      audit: { record: () => Promise.reject(broken), list: () => Promise.reject(broken) },
      keySecret: KEY_SECRET,
    });
    expect(await refusal(failing.update(by(adminId), engineerId, { role: 'LEAD' }))).toBe(broken);
    expect(await refusal(failing.update(by(adminId), engineerId, { name: 'Never Saved' }))).toBe(broken);
    expect(world.audit.committed).toEqual([]);
  });

  it('does not lift a sign-in block when the reset was rolled back', async () => {
    const failing = createUserService({
      users,
      throttles,
      hasher,
      transactions: world.transactions,
      audit: { record: () => Promise.reject(new Error('the audit write failed')), list: () => Promise.reject(new Error('unused')) },
      keySecret: KEY_SECRET,
    });
    const key = accountThrottleKey(KEY_SECRET, 'engineer@example.test');
    throttles.rows.set(key, { failures: 5, windowStartedAt: new Date('2026-11-05T09:45:00.000Z'), blockedUntil: new Date('2026-11-05T10:00:00.000Z') });
    await refusal(failing.resetPassword(by(adminId), engineerId, 'temporary-password-1'));
    expect(throttles.rows.get(key)?.blockedUntil).not.toBeNull();
  });
});

describe('PRF-03: the password is hashed before the transaction opens', () => {
  it('a reset hashes once, and the hash is made before the transaction starts, not inside it', async () => {
    let noHashYetWhenOpened = false;
    const inner = world.transactions;
    const watching = createUserService({
      users,
      throttles,
      hasher,
      transactions: {
        run: (work) => {
          // By the time a transaction opens, the password has been hashed already.
          noHashYetWhenOpened = hasher.hashed.length === 0;
          return inner.run(work);
        },
      },
      audit: { record: () => Promise.resolve(), list: () => Promise.reject(new Error('unused')) },
      keySecret: KEY_SECRET,
    });
    await watching.resetPassword(by(adminId), engineerId, 'temporary-password-1');
    expect(hasher.hashed).toHaveLength(1);
    expect(noHashYetWhenOpened).toBe(false);
  });

  it('a new person is hashed before the transaction too', async () => {
    let hashedWhenOpened = 0;
    const inner = world.transactions;
    const watching = createUserService({
      users,
      throttles,
      hasher,
      transactions: {
        run: (work) => {
          hashedWhenOpened = hasher.hashed.length;
          return inner.run(work);
        },
      },
      audit: { record: () => Promise.resolve(), list: () => Promise.reject(new Error('unused')) },
      keySecret: KEY_SECRET,
    });
    await watching.create(by(adminId), { name: 'Rohan Das', email: 'rohan.das@example.test', role: 'ENGINEER', password: 'first-password-1' });
    expect(hashedWhenOpened).toBe(1);
  });
});

describe('AC-4: an entry never holds a password, a hash or a token', () => {
  const PASSWORD = 'first-password-1';

  it('across all six events, the stored JSON holds neither the password, nor its hash, nor a key that names one', async () => {
    const created = await service.create(by(adminId), { name: 'Rohan Das', email: 'rohan.das@example.test', role: 'ENGINEER', password: PASSWORD });
    await service.update(by(adminId), created.id, { name: 'Rohan D. Das' });
    await service.update(by(adminId), created.id, { role: 'LEAD' });
    await service.update(by(adminId), created.id, { isActive: false });
    await service.update(by(adminId), created.id, { isActive: true });
    await service.resetPassword(by(adminId), created.id, PASSWORD);
    expect(world.audit.committed.map((row) => row.event)).toEqual([
      'user.created',
      'user.renamed',
      'user.role_changed',
      'user.deactivated',
      'user.activated',
      'user.password_reset',
    ]);
    const stored = JSON.stringify(world.audit.appended);
    expect(stored).not.toContain(PASSWORD);
    expect(stored).not.toContain('hash:');
    expect(stored).not.toMatch(/"(password|passwordHash|password_hash|token|hash)"/i);
    expect(stored).not.toContain('rohan.das@example.test');
  });

  it('a name that says "password" or "hash" as plain text is recorded as it is: the check is on keys and values, not on text', async () => {
    const created = await service.create(by(adminId), { name: 'Password Hash Tester', email: 'tester@example.test', role: 'LEAD', password: PASSWORD });
    await service.update(by(adminId), created.id, { name: 'Token Secret Hash' });
    expect(world.audit.committed.map((row) => [row.event, row.objectLabel])).toEqual([
      ['user.created', 'Password Hash Tester'],
      ['user.renamed', 'Token Secret Hash'],
    ]);
  });
});

describe('AC-5: the label is the name at the time', () => {
  it('a later rename leaves the earlier entries as they were and the next entry carries the new name', async () => {
    const created = await service.create(by(adminId), { name: 'Rohan Das', email: 'rohan.das@example.test', role: 'ENGINEER', password: 'first-password-1' });
    await service.update(by(adminId), created.id, { name: 'Rohan D. Das', role: 'LEAD' });
    expect(world.audit.committed.map((row) => [row.event, row.objectLabel])).toEqual([
      ['user.created', 'Rohan Das'],
      ['user.renamed', 'Rohan D. Das'],
      ['user.role_changed', 'Rohan D. Das'],
    ]);
  });

  it('the actor label is the name at the time too: it is taken from the request, not from the user now', async () => {
    const before = by(adminId);
    await service.update(before, adminId, { name: 'Renamed Admin' });
    await service.update(by(adminId), engineerId, { role: 'LEAD' });
    expect(world.audit.committed.map((row) => [row.event, row.actorLabel])).toEqual([
      ['user.renamed', 'Invented Admin'],
      ['user.role_changed', 'Renamed Admin'],
    ]);
    expect(defined(users.records.find((record) => record.id === adminId)).name).toBe('Renamed Admin');
  });
});
