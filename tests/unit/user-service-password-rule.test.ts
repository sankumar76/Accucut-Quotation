import { beforeEach, describe, expect, it } from 'vitest';

import { FieldValidationError, PASSWORD_RULE_CODE } from '@/lib/errors';
import type { UserService } from '@/server/services/user-service';

import { defined } from '../support/defined';
import type { CountingHasher, FakeUserRepository } from '../support/fake-auth-repositories';
import { createUserServiceFixture, refusal, type UserServiceFixture } from '../support/user-service-fixture';

/**
 * STORY-01.05 AC-2 and AC-4: the password rule where the Admin sets a password (`POST /users` and
 * `POST /users/{id}/password-reset`). A weak password is refused with 422 `PASSWORD_RULE` that names the failing part under the
 * `password` field, before any hash is made and before anything is stored; a valid one is accepted. Sign-in never runs the rule
 * (that is `auth-service.test.ts`: a weak stored password still signs in). Every name and password here is invented.
 */

let users: FakeUserRepository;
let hasher: CountingHasher;
let service: UserService;
let by: UserServiceFixture['by'];
let adminId: string;
let engineerId: string;

beforeEach(() => {
  ({ users, hasher, service, by, adminId, engineerId } = createUserServiceFixture());
});

const NEW_USER = { name: 'Rohan Das', email: 'Rohan.Das@Example.TEST', role: 'ENGINEER' } as const;

const WEAK: ReadonlyArray<readonly [string, string, string]> = [
  ['too short', 'Ab7!xy', 'The new password must be at least 10 characters.'],
  ['too long', `Ab7!${'x'.repeat(125)}`, 'Use 128 characters or fewer.'],
  ['without a number or a symbol', 'abcdefghijkl', 'Add at least one number and one symbol, such as ! # $ or %.'],
  ['without a number', 'abcdef-ghijkl', 'Add at least one number.'],
  ['without a symbol', 'abcdefghijk7', 'Add at least one symbol, such as ! # $ or %.'],
  ['the e-mail address of the person', 'ROHAN.DAS@example.test', "The password cannot be the same as the user's e-mail address."],
  ['common', 'Password1!', 'That password is too common. Choose a different one.'],
  ['with the product name in it', 'my-Accucut-pass-9', 'That password is too common. Choose a different one.'],
];

describe('AC-4: an Admin adds a user (POST /users)', () => {
  it.each(WEAK)('refuses a password that is %s, naming the part, and stores and hashes nothing', async (_name, password, message) => {
    // The e-mail case needs the new user's own address as the password.
    const email = message.includes('e-mail address') ? 'rohan.das@example.test' : NEW_USER.email;
    const error = await refusal(service.create(by(adminId), { ...NEW_USER, email, password }));
    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error).toMatchObject({ code: PASSWORD_RULE_CODE, httpStatus: 422, fields: [{ field: 'password', message }] });
    expect(users.records).toHaveLength(3);
    expect(hasher.hashed).toEqual([]);
  });

  it('accepts a valid password and asks for a new one at the first sign-in', async () => {
    const created = await service.create(by(adminId), { ...NEW_USER, password: 'Tn4#vLm8@Qz' });
    expect(defined(users.records.find((record) => record.id === created.id)).mustChangePassword).toBe(true);
    expect(hasher.hashed).toEqual(['Tn4#vLm8@Qz']);
  });

  it('checks the rule before it looks for a second Admin, so a weak password is named first', async () => {
    const error = await refusal(service.create(by(adminId), { ...NEW_USER, role: 'ADMIN', password: 'short' }));
    expect(error).toMatchObject({ code: PASSWORD_RULE_CODE });
  });
});

describe('AC-4: an Admin resets a password (POST /users/{id}/password-reset)', () => {
  it.each(WEAK)('refuses a password that is %s, naming the part, and changes and hashes nothing', async (_name, password, message) => {
    const target = defined(users.records.find((record) => record.id === engineerId));
    const before = target.passwordHash;
    // The e-mail case needs the target's own address as the password.
    const attempt = message.includes('e-mail address') ? target.email.toUpperCase() : password;
    const error = await refusal(service.resetPassword(by(adminId), engineerId, attempt));
    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error).toMatchObject({ code: PASSWORD_RULE_CODE, httpStatus: 422, fields: [{ field: 'password', message }] });
    expect(target.passwordHash).toBe(before);
    expect(hasher.hashed).toEqual([]);
  });

  it('accepts a valid password', async () => {
    await expect(service.resetPassword(by(adminId), engineerId, 'Tn4#vLm8@Qz')).resolves.toBeUndefined();
    expect(defined(users.records.find((record) => record.id === engineerId)).passwordHash).toBe('hash:Tn4#vLm8@Qz');
  });
});
