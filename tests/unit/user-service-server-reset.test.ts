import { describe, expect, it } from 'vitest';

import { FieldValidationError, PASSWORD_RULE_CODE } from '@/lib/errors';
import { accountThrottleKey, passwordChangeThrottleKey, stepUpThrottleKey } from '@/server/auth/throttle-key';
import type { AdminAccount, UserRepository } from '@/server/repositories/user-repository';

import { createUserServiceFixture, KEY_SECRET } from '../support/user-service-fixture';

/**
 * STORY-01.10 AC-2, AC-3 and AC-5 (AQP-428): the rules of `resetAdminPasswordOnServer` and `findAdminForServerReset` over in-memory repositories: the exactly-one-active-Admin
 * rule in all its cases (the database makes "more than one" impossible, so only a stand-in repository can show it), the password rule before any hash, the second check under
 * the lock, and what an audit entry and the throttle clearing receive. The real transaction, the lock and the rollback are `tests/integration/auth/admin-password-reset-on-server.test.ts`.
 */

const CONTEXT = { actorLabel: 'System: server command (Windows account ACCUCUT\\it.person)', requestId: 'request-aqp-428' } as const;
const PASSWORD = 'Invented-Temp-Pass-7!';

const admin = (overrides: Partial<AdminAccount> = {}): AdminAccount => ({
  id: '00000000-0000-4000-8000-abcdef000001',
  name: 'Invented Admin',
  email: 'admin@example.test',
  isActive: true,
  mustChangePassword: false,
  ...overrides,
});

/** The fixture's repository with the Admin rows it lists replaced; `listAdmins` is told whether a transaction was given. */
function withAdmins(fixture: ReturnType<typeof createUserServiceFixture>, listAdmins: (locked: boolean) => ReadonlyArray<AdminAccount>) {
  const repository: UserRepository = { ...fixture.users, listAdminAccounts: (tx) => Promise.resolve(listAdmins(tx !== undefined)) };
  return fixture.build(repository);
}

describe('AC-2: exactly one active Admin', () => {
  it('finds the one active Admin, with the name and e-mail the operator is shown', async () => {
    const { service, adminId } = createUserServiceFixture();
    expect(await service.findAdminForServerReset()).toEqual({ status: 'ready', id: adminId, name: 'Invented Admin', email: 'admin@example.test' });
  });

  it.each([
    ['no Admin row', [], 'NO_ADMIN'],
    ['one deactivated Admin', [admin({ isActive: false })], 'ADMIN_INACTIVE'],
    ['two active Admins', [admin(), admin({ id: '00000000-0000-4000-8000-abcdef000002', email: 'second@example.test' })], 'MULTIPLE_ADMINS'],
  ] as const)('%s is refused as %s, with no hash made and nothing written', async (_name, rows, refusal) => {
    const fixture = createUserServiceFixture();
    const service = withAdmins(fixture, () => rows);
    expect(await service.findAdminForServerReset()).toEqual({ status: 'refused', refusal });
    expect(await service.resetAdminPasswordOnServer(CONTEXT, PASSWORD)).toEqual({ status: 'refused', refusal });
    expect(fixture.hasher.hashed).toEqual([]);
    expect(fixture.world.audit.appended).toEqual([]);
    expect(fixture.users.records.every((record) => record.sessionVersion === 0)).toBe(true);
  });

  it('a deactivated Admin beside the one active Admin does not matter: the active one is reset', async () => {
    const fixture = createUserServiceFixture();
    const active = admin({ id: fixture.adminId });
    const service = withAdmins(fixture, () => [admin({ id: '00000000-0000-4000-8000-abcdef000009', isActive: false }), active]);
    expect(await service.resetAdminPasswordOnServer(CONTEXT, PASSWORD)).toEqual({ status: 'reset', id: fixture.adminId, name: 'Invented Admin' });
  });

  it('the check is made again under the lock: an Admin deactivated between the first look and the lock is refused, and nothing is written', async () => {
    const fixture = createUserServiceFixture();
    const service = withAdmins(fixture, (locked) => [admin({ id: fixture.adminId, isActive: !locked })]);
    expect(await service.resetAdminPasswordOnServer(CONTEXT, PASSWORD)).toEqual({ status: 'refused', refusal: 'ADMIN_INACTIVE' });
    expect(fixture.world.audit.appended).toEqual([]);
    expect(fixture.users.records.find((record) => record.id === fixture.adminId)?.passwordHash).toBe('hash:x');
    // The hash was made before the transaction (PRF-03), and is thrown away.
    expect(fixture.hasher.hashed).toEqual([PASSWORD]);
  });
});

describe('AC-3: the rule, before any hash', () => {
  it.each(['Ab1!', 'Invented-Pass-Word!', 'admin@example.test'])('%s is refused with 422 PASSWORD_RULE, makes no hash and writes nothing', async (password) => {
    const fixture = createUserServiceFixture();
    const error: unknown = await fixture.service.resetAdminPasswordOnServer(CONTEXT, password).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(FieldValidationError);
    expect((error as FieldValidationError).code).toBe(PASSWORD_RULE_CODE);
    expect(fixture.hasher.hashed).toEqual([]);
    expect(fixture.world.audit.appended).toEqual([]);
  });
});

describe('AC-5, AC-6: a valid run', () => {
  it('hashes once, sets the password, the flag and the session version, clears the three throttle keys and writes one entry with the Admin as actor and object', async () => {
    const fixture = createUserServiceFixture();
    for (const key of [accountThrottleKey(KEY_SECRET, 'admin@example.test'), passwordChangeThrottleKey(KEY_SECRET, fixture.adminId), stepUpThrottleKey(KEY_SECRET, fixture.adminId)]) {
      fixture.throttles.rows.set(key, { failures: 5, windowStartedAt: new Date('2026-11-30T09:00:00.000Z'), blockedUntil: new Date('2026-11-30T09:15:00.000Z') });
    }
    const result = await fixture.service.resetAdminPasswordOnServer(CONTEXT, PASSWORD);

    expect(result).toEqual({ status: 'reset', id: fixture.adminId, name: 'Invented Admin' });
    expect(fixture.hasher.hashed).toEqual([PASSWORD]);
    const record = fixture.users.records.find((entry) => entry.id === fixture.adminId);
    expect(record).toMatchObject({ passwordHash: `hash:${PASSWORD}`, mustChangePassword: true, sessionVersion: 1 });
    expect([...fixture.throttles.rows.values()].map((row) => [row.failures, row.blockedUntil])).toEqual([[0, null], [0, null], [0, null]]);
    expect(fixture.world.audit.committed).toHaveLength(1);
    expect(fixture.world.audit.appended).toEqual([
      expect.objectContaining({
        event: 'user.password_reset',
        actorId: fixture.adminId,
        actorLabel: CONTEXT.actorLabel,
        objectId: fixture.adminId,
        objectLabel: 'Invented Admin',
        requestId: 'request-aqp-428',
        before: { mustChangePassword: false },
        after: { mustChangePassword: true },
      }),
    ]);
    expect(JSON.stringify(fixture.world.audit.appended)).not.toContain(PASSWORD);
  });
});
