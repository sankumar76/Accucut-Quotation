/**
 * CI step 11b (NFR-009; test strategy section 10.1; STORY-10.10): fails if any route's first-load JavaScript is over its
 * limit (200,000 bytes gzip unless the table in scripts/lib/js-budget.ts says otherwise), if a route does not answer as
 * it should, or if a route cannot be measured. Nothing is skipped silently.
 *
 * It starts `next start` on a free port for the production build in `--build-dir`, requests every implemented page of the
 * route manifest (`src/server/http/route-manifest.ts`, STORY-01.02) and the not-found page, signed in as a role the
 * manifest allows on that page where the page asks for sign-in, counts the scripts each page names from `.next/static`,
 * writes one row per route to the job summary, and stops the server. A page the build serves that the manifest does not
 * list fails the check.
 *
 * Usage: npx tsx scripts/check-js-budget.ts [--build-dir <folder>] [--base-url <url>]
 *   --build-dir  the folder that holds `.next` (default: the current folder).
 *   --base-url   use a server that is already running instead of starting one (a build served elsewhere).
 * Sign-in (only when a route asks for it): MEASUREMENT_ADMIN_EMAIL and MEASUREMENT_ADMIN_PASSWORD, an invented Admin made
 * by `npx tsx scripts/ensure-measurement-user.ts`. Both are read once and never printed. The Admin may open every page,
 * so every page is measured as the Admin; a page the Admin could not open would fail with a message saying so.
 */
import { appendFileSync } from 'node:fs';

import { ROUTE_MANIFEST } from '../src/server/http/route-manifest';

import { ROUTE_LIMITS, limitTableProblems } from './lib/js-budget';
import { failedRows, headline, rowsAsMarkdown, rowsAsText } from './lib/js-budget-check';
import type { Credentials, CredentialsProvider } from './lib/js-budget-http';
import { pageRoutesFromManifest, unlistedBuildRoutes, type RouteSource } from './lib/js-budget-routes';
import { routesOfBuild, runBudgetCheck } from './lib/js-budget-run';
import { startNextServer, type RunningServer } from './next-server';

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

/** The pages to request: the manifest's implemented pages, plus a problem for each built page the manifest does not list. */
function routeSource(buildDir: string, credentialsFor: CredentialsProvider): RouteSource {
  const fromManifest = pageRoutesFromManifest(ROUTE_MANIFEST, (role) => credentialsFor(role) !== undefined);
  const built = routesOfBuild(buildDir);
  const unlisted = unlistedBuildRoutes(
    built.routes.map((route) => route.pattern),
    ROUTE_MANIFEST.filter((row) => row.kind === 'page' && row.status === 'implemented').map((row) => row.path),
  );
  return { routes: fromManifest.routes, problems: [...fromManifest.problems, ...built.problems, ...unlisted] };
}

function writeReport(rows: Parameters<typeof rowsAsMarkdown>[0]): void {
  process.stdout.write(`${rowsAsText(rows)}\n${headline(rows)}\n`);
  const summaryFile = process.env['GITHUB_STEP_SUMMARY'];
  if (summaryFile === undefined || summaryFile === '') return;
  appendFileSync(summaryFile, `### JS budget (NFR-009)\n\n${rowsAsMarkdown(rows)}\n\n${headline(rows)}\n`);
}

async function run(): Promise<number> {
  const args = process.argv.slice(2);
  const buildDir = option(args, '--build-dir') ?? '.';
  const limitProblems = limitTableProblems(ROUTE_LIMITS);
  if (limitProblems.length > 0) {
    process.stderr.write(['The limit table in scripts/lib/js-budget.ts is not acceptable:', ...limitProblems.map((line) => `  - ${line}`), ''].join('\n'));
    return 1;
  }
  const credentialsFor = credentialsFromEnvironment();
  const source = routeSource(buildDir, credentialsFor);

  const given = option(args, '--base-url');
  let server: RunningServer | undefined;
  try {
    server = given === undefined ? await startNextServer(buildDir, process.env) : undefined;
    const baseUrl = (given ?? server?.baseUrl ?? '').replace(/\/+$/, '');
    const rows = await runBudgetCheck({ buildDir, baseUrl, credentialsFor, source });
    writeReport(rows);
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
