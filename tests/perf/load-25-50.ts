/**
 * The load, capacity and volume run of NFR-010 and NFR-011 (STORY-10.09 AC-1 to AC-4, AC-9, AC-10; test strategy sections 8.1 and 8.2): a Node script with `fetch` only, no new dependency, and no k6.
 *
 * It signs in as the invented Admin, makes the data through the public API (500 customers x 50 rates, 200 materials, 50 treatments, a queue of tasks, and two estimates of 500 parts, one of them
 * calculated by its own Engineer), and runs these phases, each a closed loop of virtual users with 1 s think time (the first 25 requests of each read are a warm-up and are dropped; the p95 is nearest-rank):
 *
 *   volume      the customers list and one-customer reads at 25 users on the planning volume (section 8.1 a, b, d), then with no think time (e, reported)
 *   mix-low     queue, tree, part form, cost details and part save at 25 users: every line p95 <= 500 ms (AC-1)
 *   mix-high    the same at 50 users: no error and no timeout; the p95 and the size of the tree answer are reported (AC-3)
 *   export      the page reads at 25 users while a 500-part export runs: p95 <= 500 ms (AC-4)
 *   password    the own-password change, one at a time, 20 in series: p95 <= 1,000 ms (AC-2; reported only when LOAD_PASSWORD_REPORT_ONLY=1, as on the CI runner)
 *
 * A breach is printed with the phase, the line and the figure, and the exit code is 1. Nothing here prints a password or a cookie; every name and number is an invented placeholder (ADR-014).
 *
 * Run it against a production build (`next start`) on a throwaway database with the invented Admin made (`scripts/ensure-measurement-user.ts`):
 *   node --conditions=react-server --import tsx tests/perf/load-25-50.ts
 * The condition is needed because the `tree500` fixture imports the formula engine (see `scripts/ensure-seed-version.ts`).
 *
 * Environment: MEASUREMENT_ADMIN_EMAIL and MEASUREMENT_ADMIN_PASSWORD (required); LOAD_BASE_URL (default http://localhost:3000; it must be the portal's own APP_ORIGIN); LOAD_PHASES; the sizes
 * in `load/config.ts`; LOAD_REPORT_FILE (a path: the markdown report is also written there). GITHUB_STEP_SUMMARY, when set, receives the report.
 */
import { appendFileSync, writeFileSync } from 'node:fs';

import { describeMachine } from '../support/perf-stats';

import { openSession } from './load/client';
import { LoadConfigError, readConfig, type LoadConfig, type Phase } from './load/config';
import { breachesOf, formatReport, type PhaseResult } from './load/judge';
import { seedMasters, verifyVolume } from './load/seed-masters';
import { seedEstimates, type EstimateWorld } from './load/seed-estimates';
import { runExport, runMixHigh, runMixLow, runPassword, runVolume, type Context, type WorldContext } from './load/scenarios';

const log = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

const ESTIMATE_PHASES: ReadonlyArray<Phase> = ['mix-low', 'mix-high', 'export', 'password'];

function writeReport(report: string): void {
  const summary = process.env['GITHUB_STEP_SUMMARY'];
  if (summary !== undefined && summary !== '') appendFileSync(summary, `${report}\n`);
  const file = process.env['LOAD_REPORT_FILE'];
  if (file !== undefined && file !== '') writeFileSync(file, `${report}\n`);
}

async function runPhases(config: LoadConfig, context: Context, world: EstimateWorld | undefined): Promise<ReadonlyArray<PhaseResult>> {
  const results: PhaseResult[] = [];
  const step = async (phase: Phase, work: () => Promise<PhaseResult | ReadonlyArray<PhaseResult>>): Promise<void> => {
    if (!config.phases.has(phase)) return;
    log('phase ' + phase + ': running');
    const started = Date.now();
    const done = await work();
    results.push(...(Array.isArray(done) ? done : [done]));
    log('phase ' + phase + ': done in ' + Math.round((Date.now() - started) / 1000) + ' s');
  };
  const withWorld = (): WorldContext => {
    if (world === undefined) throw new Error('the estimates were not seeded');
    return { ...context, world };
  };
  await step('volume', () => runVolume(context));
  await step('mix-low', () => runMixLow(withWorld()));
  await step('mix-high', () => runMixHigh(withWorld()));
  await step('export', () => runExport(withWorld()));
  await step('password', () => runPassword(withWorld(), config.passwordReportOnly));
  return results;
}

async function main(): Promise<void> {
  const config = readConfig(process.env);
  log(`load run against ${config.baseUrl}; ${describeMachine()}`);
  const admin = await openSession(config.baseUrl, 'admin', config.adminEmail, config.adminPassword);
  log('seeding the master data through the API');
  const masters = await seedMasters(admin, config);
  await verifyVolume(admin, config, masters);
  log(`master data is as the run needs: ${masters.customers.length} customers, ${config.processItemsTotal} rates each`);
  const needsEstimates = ESTIMATE_PHASES.some((phase) => config.phases.has(phase));
  const world = needsEstimates ? await seedEstimates(admin, config, masters) : undefined;
  if (needsEstimates) log(`seeded ${config.queueTasks} queue tasks, estimate A and ${config.saveEstimates} for the saves, each of ${config.parts} parts`);
  const results = await runPhases(config, { config, masters, revisions: new Map() }, world);
  const report = formatReport(results);
  log(`\n${report}`);
  writeReport(`## Capacity and latency (NFR-010, NFR-011)\n\nMachine: ${describeMachine()}\n\n${report}`);
  const breaches = breachesOf(results);
  for (const breach of breaches) process.stderr.write(`BREACH: ${breach}\n`);
  if (breaches.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  // The message names the call and the status, never a body or a credential.
  const message = error instanceof Error ? error.message : 'unexpected error';
  process.stderr.write(`load run failed: ${error instanceof LoadConfigError ? `setting: ${message}` : message}\n`);
  process.exitCode = 1;
});
