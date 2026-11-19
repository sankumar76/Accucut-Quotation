import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { REPOSITORY_ROOT, textFilesIn, trackedFiles } from '../support/scan-files';

/**
 * STORY-10.12 AC-6 (ASSUMPTION-26, NFR-028): no retention rule exists in R1 for personal data (Q-26 is open), so nothing in the
 * scheduled jobs, the worker or the scripts may delete a `users` or `customers` row. The only removal that exists is the soft
 * delete of a customer (it sets `deleted_at`, the row stays). A job that purged people would be a retention rule by the back door:
 * it needs the answer to Q-26 and a story of its own, and then this test is changed with it.
 */

const JOB_SCOPE: ReadonlyArray<string> = ['src/server/jobs/', 'src/worker/', 'scripts/'];

/** The tables of people. */
const PERSONAL_TABLES = String.raw`(?:users?|customers?)`;

/** Ways to remove rows of those tables: the ORM's delete calls, and the SQL statements (a quoted or schema-qualified name counts). */
const DELETION_PATTERNS: ReadonlyArray<{ readonly what: string; readonly pattern: RegExp }> = [
  { what: 'an ORM delete call', pattern: new RegExp(String.raw`\b${PERSONAL_TABLES}\s*\.\s*(?:delete|deleteMany)\s*\(`, 'gi') },
  { what: 'a SQL DELETE', pattern: new RegExp(String.raw`\bDELETE\s+FROM\s+(?:ONLY\s+)?(?:"?public"?\s*\.\s*)?"?${PERSONAL_TABLES}\b`, 'gi') },
  { what: 'a SQL TRUNCATE', pattern: new RegExp(String.raw`\bTRUNCATE\s+(?:TABLE\s+)?[^;\n]*?\b${PERSONAL_TABLES}\b`, 'gi') },
  { what: 'a SQL DROP TABLE', pattern: new RegExp(String.raw`\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:"?public"?\s*\.\s*)?"?${PERSONAL_TABLES}\b`, 'gi') },
];

interface DeletionFinding {
  readonly file: string;
  readonly line: number;
  readonly what: string;
}

/** The deletions of people's rows in `text`, with the line each starts on. */
function findPersonalDataDeletions(file: string, text: string): DeletionFinding[] {
  return DELETION_PATTERNS.flatMap(({ what, pattern }) =>
    [...text.matchAll(pattern)].map((match) => ({ file, line: text.slice(0, match.index).split('\n').length, what })),
  );
}

describe('AC-6: nothing in jobs, the worker or the scripts deletes users or customers', () => {
  let scanned: string[] = [];

  beforeAll(() => {
    scanned = textFilesIn(trackedFiles(), JOB_SCOPE);
  });

  it('reads the job code, the worker and the scripts, so a pass is not an empty search', () => {
    expect(scanned).toContain('src/server/jobs/backup-watch.ts');
    expect(scanned).toContain('src/server/jobs/log-prune.ts');
    expect(scanned.some((file) => file.startsWith('src/worker/'))).toBe(true);
    expect(scanned.some((file) => file.startsWith('scripts/'))).toBe(true);
  });

  it('AC-6: finds no ORM delete and no DELETE, TRUNCATE or DROP TABLE on users or customers', () => {
    const findings = scanned.flatMap((file) => findPersonalDataDeletions(file, readFileSync(join(REPOSITORY_ROOT, file), 'utf8')));
    expect(findings.map((finding) => `${finding.file}:${finding.line}: ${finding.what}`)).toEqual([]);
  });
});

describe('AC-6: negative control, a planted deletion is found and the soft delete is not', () => {
  it.each([
    ['an ORM delete of a customer', 'await tx.customer.delete({ where: { id } });'],
    ['an ORM deleteMany of customers', 'await db.customers.deleteMany({ where: { deletedAt: { lt: cutoff } } });'],
    ['an ORM delete of a user', 'await prisma.user.delete({ where: { id } });'],
    ['an ORM deleteMany of users, spaced out', 'await prisma.user\n  .deleteMany(\n  {});'],
    ['a SQL DELETE on customers', "await db.$executeRaw`DELETE FROM customers WHERE deleted_at < now() - interval '90 days'`;"],
    ['a lower-case SQL delete on users', 'delete from users where is_active = false;'],
    ['a SQL DELETE with the schema and quotes', 'DELETE FROM "public"."users" WHERE id = $1'],
    ['a SQL DELETE across two lines', 'DELETE\n  FROM customers\n WHERE id = $1'],
    ['a SQL TRUNCATE', 'TRUNCATE TABLE customer_rates, customers;'],
    ['a SQL DROP TABLE', 'DROP TABLE IF EXISTS users CASCADE;'],
  ])('finds %s', (_name, text) => {
    expect(findPersonalDataDeletions('src/server/jobs/purge.ts', text)).toHaveLength(1);
  });

  it('reports the file and the line', () => {
    const text = ['export async function purge() {', '  const cutoff = new Date();', '  await tx.customer.deleteMany({ where: {} });', '}'].join('\n');
    expect(findPersonalDataDeletions('src/server/jobs/purge.ts', text)).toEqual([{ file: 'src/server/jobs/purge.ts', line: 3, what: 'an ORM delete call' }]);
  });

  it.each([
    ['the soft delete of a customer', 'await tx.customer.update({ where: { id }, data: { deletedAt: now } });'],
    ['the soft delete in SQL', 'UPDATE customers SET deleted_at = now() WHERE id = $1'],
    ['a delete on a table that is not a person', 'await tx.jobRun.deleteMany({ where: { startedAt: { lt: cutoff } } });'],
    ['a SQL delete of customer rates', 'DELETE FROM customer_rates WHERE process_item_id = $1'],
    ['a delete of a Map entry named for a user', 'usersById.delete(id);'],
    ['text that names the tables', '// Never delete users or customers: Q-26 is open.'],
    ['a file delete', "await rm(join(directory, 'users.log'));"],
  ])('does not find %s', (_name, text) => {
    expect(findPersonalDataDeletions('src/server/jobs/job.ts', text)).toEqual([]);
  });
});
