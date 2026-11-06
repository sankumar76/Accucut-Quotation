import { describe, expect, it } from 'vitest';

import { AuditEntryRefusedError, AUDIT_ENTRY_REFUSED_CODE, findSecretPath } from '@/server/services/audit-secrets';

/**
 * STORY-01.07 T3 (AC-4): the guard that judges the keys and the values of what an entry would keep, not the words. Every value
 * here is invented; the "hashes" are the shape of a hash and nothing more.
 */

/**
 * The shape of a JSON Web Token, put together at run time from invented parts: written out whole, the secret scan (Gitleaks, CI
 * stage 2) reads it as a real token and fails the build, the way `scripts/secret-scan-control.ts` builds its fake secret.
 */
const JWT_SHAPED = ['eyJ', 'invented-header', '.', 'eyJ', 'invented-claims', '.'].join('');

describe('AC-4: findSecretPath', () => {
  it.each(['password', 'Password', 'passwordHash', 'password_hash', 'PASSWORD-HASH', 'newPassword', 'currentPassword', 'hash', 'token', 'accessToken', 'secret', 'apiKey'])(
    'finds a key called %s, at any depth',
    (key) => {
      expect(findSecretPath({ [key]: 'x' })).toBe(key);
      expect(findSecretPath({ after: { nested: { [key]: 1 } } })).toBe(`after.nested.${key}`);
      expect(findSecretPath({ list: [{ [key]: true }] })).toBe(`list[0].${key}`);
    },
  );

  it.each(['$argon2id$v=19$m=19456,t=2,p=1$invented$invented', '$2b$10$invented', '$scrypt$ln=15$invented', '$pbkdf2-sha256$i=1$invented', JWT_SHAPED])(
    'finds a value that is the shape of a password hash or a token: %s',
    (value) => {
      expect(findSecretPath({ after: { note: value } })).toBe('after.note');
      expect(findSecretPath([value])).toBe('[0]');
    },
  );

  it('judges keys and values, not text: the words in a name, a reason or a key that merely contains them are fine', () => {
    expect(findSecretPath({ before: null, after: { name: 'Password Hash Tester', reason: 'password reset, new hash, token refreshed' } })).toBeNull();
    expect(findSecretPath({ mustChangePassword: true, hashtags: 2, tokenCount: 3, secretary: 'x' })).toBeNull();
    expect(findSecretPath({ price: '$12.50', code: '$argon' })).toBeNull();
  });

  it('finds nothing in values that are not strings, objects or arrays', () => {
    expect(findSecretPath(null)).toBeNull();
    expect(findSecretPath(42)).toBeNull();
    expect(findSecretPath(true)).toBeNull();
    expect(findSecretPath(undefined)).toBeNull();
    expect(findSecretPath({})).toBeNull();
    expect(findSecretPath([])).toBeNull();
  });
});

describe('AC-4: AuditEntryRefusedError', () => {
  it('has a fixed message and a code, and says where the problem is and never what it is', () => {
    const error = new AuditEntryRefusedError('secret', 'after.passwordHash');
    expect(error).toMatchObject({ code: AUDIT_ENTRY_REFUSED_CODE, httpStatus: 500, reason: 'secret', where: 'after.passwordHash' });
    expect(error.message).toBe('An audit entry was refused: it holds a secret or does not match its event.');
    expect(error.message).not.toContain('passwordHash');
  });
});
