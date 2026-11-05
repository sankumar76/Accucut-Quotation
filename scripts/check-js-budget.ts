/**
 * CI step 11b (NFR-009; test strategy section 10.1; STORY-10.10): fails if any route's first-load JavaScript is over its
 * limit (200,000 bytes gzip unless the table in scripts/lib/js-budget.ts says otherwise), if a route does not answer as
 * it should, or if a route cannot be measured. Nothing is skipped silently.
 *
 * It starts `next start` on a free port for the production build in `--build-dir`, requests every page route and the
 * not-found page (signed in as the Admin where a route asks for sign-in), counts the scripts each page names from
 * `.next/static`, writes one row per route to the job summary, and stops the server.
 *
 * Usage: npx tsx scripts/check-js-budget.ts [--build-dir <folder>] [--base-url <url>]
 *   --build-dir  the folder that holds `.next` (default: the current folder).
 *   --base-url   use a server that is already running instead of starting one (a build served elsewhere).
 * Sign-in (only when a route asks for it): MEASUREMENT_ADMIN_EMAIL and MEASUREMENT_ADMIN_PASSWORD, an invented Admin made
 * by `npx tsx scripts/ensure-measurement-user.ts`. Both are read once and never printed.
 */
import { appendFileSync, existsSync } from 'node:fs';

import { ROUTE_LIMITS, limitTableProblems } from './lib/js-budget';
import { failedRows, headline, rowsAsMarkdown, rowsAsText } from './lib/js-budget-check';
import type { Credentials, CredentialsProvider } from './lib/js-budget-http';
import { runBudgetCheck } from './lib/js-budget-run';
import { startNextServer, type RunningServer } from './next-server';

/** Until the route manifest of STORY-01.02 is read here, a route is opened as the Admin only (STORY-10.10 AC-1). */
const ROUTE_MANIFEST_FILE = 'src/server/http/route-manifest.ts';

function option(args: ReadonlyArray<string>, name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function credentialsFromEnvironment(): CredentialsProvider {
  const email = process.env['MEASUREMENT_ADMIN_EMAIL'];
  const password = process.env['MEASUREMENT_ADMIN_PASSWORD'];
  const admin: Credentials | undefined = email !== undefined && email !== '' && password !== undefined && password !== '' ? { email, password } : undefined;
  return (role) => (role === 'ADMIN' ? admin : undefined);
}

function writeReport(rows: Parameters<typeof rowsAsMarkdown>[0], warnings: ReadonlyArray<string>): void {
  process.stdout.write(`${rowsAsText(rows)}\n${headline(rows)}\n`);
  const summaryFile = process.env['GITHUB_STEP_SUMMARY'];
  if (summaryFile === undefined || summaryFile === '') return;
  const notes = warnings.map((warning) => `\n> ${warning}`).join('');
  appendFileSync(summaryFile, `### JS budget (NFR-009)\n\n${rowsAsMarkdown(rows)}\n\n${headline(rows)}${notes}\n`);
}

async function run(): Promise<number> {
  const args = process.argv.slice(2);
  const buildDir = option(args, '--build-dir') ?? '.';
  const limitProblems = limitTableProblems(ROUTE_LIMITS);
  if (limitProblems.length > 0) {
    process.stderr.write(['The limit table in scripts/lib/js-budget.ts is not acceptable:', ...limitProblems.map((line) => `  - ${line}`), ''].join('\n'));
    return 1;
  }
  const warnings: string[] = [];
  if (existsSync(ROUTE_MANIFEST_FILE)) {
    warnings.push(`${ROUTE_MANIFEST_FILE} exists, but this check does not read it yet: routes were opened as the Admin only. Read the manifest in scripts/check-js-budget.ts.`);
    process.stderr.write(`warning: ${warnings[0] ?? ''}\n`);
  }

  const given = option(args, '--base-url');
  let server: RunningServer | undefined;
  try {
    server = given === undefined ? await startNextServer(buildDir, process.env) : undefined;
    const baseUrl = (given ?? server?.baseUrl ?? '').replace(/\/+$/, '');
    const rows = await runBudgetCheck({ buildDir, baseUrl, credentialsFor: credentialsFromEnvironment() });
    writeReport(rows, warnings);
    return failedRows(rows).length === 0 ? 0 : 1;
  } finally {
    await server?.stop();
  }
}

run().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`JS budget check could not run: ${error instanceof Error ? error.message : 'unexpected error'}\n`);
    process.exitCode = 1;
  },
);
