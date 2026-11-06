import { AppError } from '../../lib/errors';

/**
 * The last line of defence for AC-4 (STORY-01.07): an audit entry never holds a password, a password hash or a token. The
 * first line is the registry, whose schemas name every field an event may keep (`audit-events.ts`), so a secret has no field
 * to go in. This check runs on whatever the schemas let through, so a later event with a loose shape (the reserved ones accept
 * any JSON) cannot start to keep one by mistake. It judges **keys and values, not text**: a person called "Hash Password" or a
 * reason that says "password reset" passes, a key called `passwordHash` or a value that is an argon2 hash does not.
 *
 * It names where it found something (the path of keys) and never what, so the refusal itself cannot leak the secret.
 */

/** Keys that mean a secret, compared in lower case with `_` and `-` removed. Exact names: `mustChangePassword` is not one. */
const SECRET_KEYS: ReadonlySet<string> = new Set([
  'password',
  'passwd',
  'newpassword',
  'currentpassword',
  'temporarypassword',
  'passwordhash',
  'hash',
  'token',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'csrftoken',
  'secret',
  'clientsecret',
  'authsecret',
  'apikey',
  'privatekey',
]);

/** A password hash in the PHC or crypt form (`$argon2id$...`, `$2b$...`, `$scrypt$...`, `$pbkdf2-sha256$...`). */
const PASSWORD_HASH_VALUE = /^\$(argon2(id|i|d)|2[abxy]|scrypt|pbkdf2[\w-]*)\$/i;

/** A JSON Web Token: three base64url parts, the first of which opens with an encoded `{"`. */
const TOKEN_VALUE = /^eyJ[\w-]+\.[\w-]+\.[\w-]*$/;

function normalisedKey(key: string): string {
  return key.toLowerCase().replaceAll('_', '').replaceAll('-', '');
}

function isSecretValue(value: string): boolean {
  return PASSWORD_HASH_VALUE.test(value) || TOKEN_VALUE.test(value);
}

/** The path (for example `after.passwordHash`) of the first secret found in a JSON value, or null if there is none. */
export function findSecretPath(value: unknown, path = ''): string | null {
  if (typeof value === 'string') return isSecretValue(value) ? path : null;
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findSecretPath(item, `${path}[${String(index)}]`);
      if (found !== null) return found;
    }
    return null;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      const here = path === '' ? key : `${path}.${key}`;
      if (SECRET_KEYS.has(normalisedKey(key))) return here;
      const found = findSecretPath(item, here);
      if (found !== null) return found;
    }
  }
  return null;
}

export const AUDIT_ENTRY_REFUSED_CODE = 'AUDIT_ENTRY_REFUSED';

/**
 * The entry was not written, and so the change it belongs to was not either (the transaction rolls back). It is a mistake in
 * the code that raised the event, found by the test of that event; the message is fixed and carries no value.
 */
export class AuditEntryRefusedError extends AppError {
  constructor(
    readonly reason: 'secret' | 'shape',
    /** Where the problem is, as a path of key names. Never a value. */
    readonly where: string,
  ) {
    super(AUDIT_ENTRY_REFUSED_CODE, 500, 'An audit entry was refused: it holds a secret or does not match its event.');
  }
}
