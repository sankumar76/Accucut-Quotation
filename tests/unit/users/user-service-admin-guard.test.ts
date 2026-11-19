import { describe, expect, it } from 'vitest';

import { ADMIN_CANNOT_BE_REMOVED_CODE, ADMIN_CANNOT_BE_REMOVED_MESSAGE } from '@/lib/users/hand-over';

import { createUserServiceFixture, refusal } from '../../support/user-service-fixture';

/**
 * STORY-01.09 AC-7 (nothing half done, the portal always has an Admin): an edit by someone else cannot take the Admin role from the Admin or deactivate them. Before the hand-over existed only the Admin
 * made edits, and an Admin could not edit themself (`CANNOT_CHANGE_OWN_ROLE`, `CANNOT_DEACTIVATE_OWN_ACCOUNT`), so no edit could ever do it. A hand-over changes that: a request of the old Admin that had passed
 * the role check and waited for the new Admin's row lock would otherwise run afterwards, on the new Admin, and leave the portal with no active Admin. The real overlap is
 * `tests/integration/users/admin-handover.test.ts`.
 */

describe('AC-7: an edit cannot remove the Admin role from the active Admin, whoever asks', () => {
  it.each([
    ['a role', { role: 'LEAD' as const }],
    ['the active flag', { isActive: false }],
    ['both', { role: 'ENGINEER' as const, isActive: false }],
  ])('refuses %s change of the Admin by another person with 409 ADMIN_CANNOT_BE_REMOVED, and changes nothing', async (_name, changes) => {
    const { service, by, adminId, leadId, users, world } = createUserServiceFixture();
    const error = await refusal(service.update(by(leadId), adminId, changes));
    expect(error).toMatchObject({ httpStatus: 409, code: ADMIN_CANNOT_BE_REMOVED_CODE, message: ADMIN_CANNOT_BE_REMOVED_MESSAGE });
    expect(users.records.find((record) => record.id === adminId)).toMatchObject({ role: 'ADMIN', isActive: true, sessionVersion: 0 });
    expect(world.audit.appended).toEqual([]);
  });

  it('still lets the Admin be renamed, and the Admin rules for the Admin themself keep their own codes', async () => {
    const { service, by, adminId, leadId } = createUserServiceFixture();
    expect((await service.update(by(leadId), adminId, { name: 'Invented Renamed Admin' })).name).toBe('Invented Renamed Admin');
    expect(await refusal(service.update(by(adminId), adminId, { role: 'LEAD' }))).toMatchObject({ code: 'CANNOT_CHANGE_OWN_ROLE' });
    expect(await refusal(service.update(by(adminId), adminId, { isActive: false }))).toMatchObject({ code: 'CANNOT_DEACTIVATE_OWN_ACCOUNT' });
  });

  it('does not touch an Admin who is already deactivated (reactivating is the one-Admin rule\'s) or a person who is not an Admin', async () => {
    const { service, by, adminId, engineerId } = createUserServiceFixture();
    expect((await service.update(by(adminId), engineerId, { role: 'LEAD', isActive: false })).isActive).toBe(false);
  });
});
