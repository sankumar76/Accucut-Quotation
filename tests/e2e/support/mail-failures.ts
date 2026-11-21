import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

import { assertSafeDatabaseTarget } from '../../support/db-guard';

import { E2E_LEAD } from './auth';

/**
 * One e-mail that failed for good, put into the outbox of the database the servers use, for the Settings notice "E-mails not sent" (STORY-09.06 AC-8). The server renders the notice from
 * the database, so a stubbed answer of the route cannot show it. The row is what `outbox-send` leaves after the 4th failed attempt: `failed`, four attempts, one class code, the time of
 * the last attempt in `next_attempt_at`; it names the E2E Lead by ID, holds no address and a body of invented text. The URL is judged by the same guard as every test run; the runtime role
 * cannot delete the row, and the database is a throwaway one. The notice shows the last problem of the NEWEST failed row, so every case that seeds uses the same code.
 */
export async function seedFailedMail(code: 'CONNECTION' = 'CONNECTION'): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url === '') throw new Error('DATABASE_URL is not set. Start the test database and set it as the README says.');
  assertSafeDatabaseTarget({ ...process.env, DATABASE_URL: url });
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const inserted = await client.query(
      `INSERT INTO email_outbox (idempotency_key, event, to_user_id, subject, body_html, body_text, status, attempts, last_error, next_attempt_at)
       SELECT $1, 'backup-missed', id, 'E2E invented subject', '<p>invented</p>', 'invented', 'failed', 4, $2, now() FROM users WHERE email = $3`,
      [`backup-missed:e2e-failed-${randomUUID()}`, code, E2E_LEAD.email],
    );
    if (inserted.rowCount !== 1) throw new Error('The E2E Lead does not exist yet: the set-up project makes it.');
  } finally {
    await client.end();
  }
}
