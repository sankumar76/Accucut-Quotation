import { prepareTestEnvironment } from './dotenv';

/**
 * Vitest `globalSetup`: runs once before any suite, so a wrong database is refused before a test can
 * connect to it (AC-10). It loads `.env` first, so the guard judges the settings Prisma will use. The
 * decision itself lives in `db-guard.ts` so it can be tested directly; tests/unit/global-setup-wiring
 * proves this file is the one Vitest runs.
 */
export default function setup(): () => Promise<void> {
  prepareTestEnvironment(process.env);
  return countMailpit;
}

/** ONE-OFF (AQP-412, DL-325 (7)(iii)): prints how many messages the run's Mailpit took in. Removed in the next commit. */
async function countMailpit(): Promise<void> {
  const api = process.env['MAILPIT_API_URL'];
  if (api === undefined || api === '') return;
  const info = (await (await fetch(`${api}/api/v1/info`)).json()) as { Messages: number; RuntimeStats: { SMTPAccepted: number; MessagesDeleted: number } };
  process.stdout.write(`MAILPIT-COUNT stored=${info.Messages} accepted=${info.RuntimeStats.SMTPAccepted} deleted=${info.RuntimeStats.MessagesDeleted}\n`);
}
