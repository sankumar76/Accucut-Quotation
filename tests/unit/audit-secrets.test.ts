import { Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors';
import { createLogger, REDACTED_VALUE } from '@/lib/logger';
import { internalProblem, problemFromAppError } from '@/server/http/problem';
import { AUDIT_EVENTS } from '@/server/services/audit-events';
import { createAuditService } from '@/server/services/audit-service';
import { AuditEntryRefusedError, AUDIT_ENTRY_REFUSED_CODE, findSecretPath } from '@/server/services/audit-secrets';

import { createFakeAuditWorld } from '../support/fake-audit';

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

/**
 * STORY-10.12 AC-4 (NFR-028, NFR-024, coding standards section 4): the same rule, followed out to the other places a secret or a person's details could
 * leak from: the audit rows, the logs and the error bodies. Passwords, hashes and tokens never appear in any of them; a user's e-mail address may be
 * in the audit actor label and nowhere else in an audit row. Every value here is invented.
 */

const PASSWORD_HASH_SHAPED = '$argon2id$v=19$m=19456,t=2,p=1$invented$invented';
const INVENTED_EMAIL = 'invented.admin@example.test';

describe('STORY-10.12 AC-4: audit rows', () => {
  it('a user e-mail address is kept in the actor label and in no other part of the row', async () => {
    const world = createFakeAuditWorld();
    const service = createAuditService({ audit: world.audit });
    await world.transactions.run((tx) =>
      service.record(tx, {
        event: 'user.created',
        actorId: '00000000-0000-4000-8000-abcdef000001',
        actorLabel: INVENTED_EMAIL,
        requestId: 'req-0a0b0c0d',
        object: { id: '00000000-0000-4000-8000-abcdef000003', label: 'Invented Person' },
        before: null,
        after: { role: 'ENGINEER', isActive: true },
      }),
    );
    const [row] = world.audit.committed;
    expect(row?.actorLabel).toBe(INVENTED_EMAIL);
    expect(JSON.stringify({ ...row, actorLabel: undefined })).not.toContain('@');
  });

  it.each(Object.entries(AUDIT_EVENTS).filter(([, definition]) => definition.status === 'wired'))(
    'the event %s has no field a password, a hash, a token or a person\'s contact detail could be kept in',
    (_name, definition) => {
      const planted = { email: INVENTED_EMAIL, phone: '+99 555 0142', address: 'Invented Street', password: 'invented', passwordHash: PASSWORD_HASH_SHAPED, token: JWT_SHAPED };
      // The generic master events take their shape from the master named on the entry; the Process Master is the one they are wired for.
      const schemas = definition.schemasFor(definition.objectType === 'master' ? 'process_item' : definition.objectType);
      expect(schemas, 'the event has a shape for its own object type').not.toBeNull();
      expect(schemas?.before.safeParse(planted).success).toBe(false);
      expect(schemas?.after.safeParse(planted).success).toBe(false);
    },
  );
});

describe('STORY-10.12 AC-4: logs', () => {
  function logged(entry: Record<string, unknown>): string {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });
    createLogger({}, stream).info(entry, 'message');
    return chunks.join('');
  }

  it('redacts a password hash, a password, a token and an e-mail address, at the top level and one level down', () => {
    const entry = { passwordHash: PASSWORD_HASH_SHAPED, password: 'invented-password', token: JWT_SHAPED, email: INVENTED_EMAIL };
    for (const line of [logged(entry), logged({ user: entry })]) {
      expect(line).toContain(REDACTED_VALUE);
      for (const value of Object.values(entry)) expect(line).not.toContain(value);
    }
  });
});

describe('STORY-10.12 AC-4: error bodies', () => {
  it('a server error says the same generic words whatever its message holds: no hash, no token, no e-mail address', () => {
    const failure = new AppError('INVENTED_FAILURE', 500, `failed for ${INVENTED_EMAIL} with ${PASSWORD_HASH_SHAPED} and ${JWT_SHAPED}`);
    for (const body of [JSON.stringify(problemFromAppError(failure, 'req-1')), JSON.stringify(internalProblem('req-1'))]) {
      for (const value of [INVENTED_EMAIL, PASSWORD_HASH_SHAPED, JWT_SHAPED]) expect(body).not.toContain(value);
    }
  });

  it('a refused audit entry names no path and no value in what the client receives', () => {
    const body = JSON.stringify(problemFromAppError(new AuditEntryRefusedError('secret', 'after.passwordHash'), 'req-1'));
    expect(body).not.toContain('passwordHash');
    const parsed: unknown = JSON.parse(body);
    expect(findSecretPath(parsed)).toBeNull();
  });
});
