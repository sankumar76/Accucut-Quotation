import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SEND_FAILURE_CODES, SKIP_CODES } from '@/lib/mail/codes';

/**
 * STORY-09.01 AC-7 and SQR-04 (review of PR #503): `email_outbox.last_error` is a class code and never a message, and the database enforces it with a CHECK. The list in the migration
 * must equal the list in code, so a code added to `src/lib/mail/codes.ts` without the migration (or the reverse) fails here and not in production.
 */

const migration = readFileSync(fileURLToPath(new URL('../../../prisma/migrations/20261118120000_email_outbox_and_settings/migration.sql', import.meta.url)), 'utf8');

function checkedCodes(): string[] {
  const match = /"ck_email_outbox_last_error_code" CHECK \("last_error" IS NULL OR "last_error" IN \(([^)]*)\)\)/.exec(migration);
  if (match?.[1] === undefined) throw new Error('The CHECK on last_error is not in the migration.');
  return [...match[1].matchAll(/'([A-Z_]+)'/g)].map((code) => code[1] ?? '');
}

describe('the codes of last_error (AC-7, SQR-04)', () => {
  it('the CHECK of the migration lists exactly the send failure codes and the skip codes of src/lib/mail/codes.ts', () => {
    expect([...checkedCodes()].sort()).toEqual([...SEND_FAILURE_CODES, ...SKIP_CODES].sort());
  });

  it('there are eight codes, each used once', () => {
    const codes = [...SEND_FAILURE_CODES, ...SKIP_CODES];
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
  });
});
