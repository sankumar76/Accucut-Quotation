import { performance } from 'node:perf_hooks';

import { fieldIdOf } from '../../support/complete-part';

import { call, jsonOf, openSession, type Reply, type Session } from './client';
import { runClosedLoop, summariseLine, warmupRoundsFor, withinWindow, type LineSamples, type LoadLine, type Sample } from './closed-loop';
import type { LoadConfig } from './config';
import { NFR_010_LINE_MS, OWN_PASSWORD_LINE_MS, type PhaseResult } from './judge';
import { quantityFor } from './plan';
import { changeOwnPassword, type EstimateWorld, type PartRef } from './seed-estimates';
import type { MasterData } from './seed-masters';

/**
 * The phases of the load run (test strategy 8.1 and 8.2; STORY-10.09). Each builds the lines of one load, runs the closed loop, and returns a `PhaseResult` for `judge.ts`.
 *
 *   volume      NFR-011, section 8.1: the customers list and one-customer reads at 25 users on the 500 x 50 data, judged at 500 ms; then the same reads with no think time (saturation), reported.
 *   mix-low     NFR-010, AC-1: queue, tree, part form, cost details and the part save at 25 users, every line judged at 500 ms; the estimate-level cost read is reported.
 *   mix-high    NFR-011, AC-3: the same load at 50 users: no error and no timeout; the p95 is reported.
 *   export      NFR-010, AC-4: the page reads at 25 users while a 500-node export runs, judged at 500 ms.
 *   password    NFR-010, AC-2: the own-password change, one request at a time, after 2 warm-up changes.
 *
 * The Admin's session is the one every virtual user signs in as (the portal allows one Admin; test strategy 8.1 does the same): 25 or 50 sign-ins give 25 or 50 sessions.
 */

const OK = 200;
const NO_CONTENT = 204;
const PASSWORD_WARMUP_CHANGES = 2;
const SATURATION_USERS_NOTE = 'saturation: no think time';
const COST_NODES_CYCLED = 20;

/** What every phase needs: the settings, the master data, and the revision of each part of B as the load last saw it (shared by every phase that saves). */
export interface Context {
  readonly config: LoadConfig;
  readonly masters: MasterData;
  readonly revisions: Map<string, number>;
}

/** What a phase that reads or writes the two estimates needs. */
export interface WorldContext extends Context {
  readonly world: EstimateWorld;
}

/** One signed-in session for each virtual user. */
export async function openSessions(config: LoadConfig, users: number): Promise<ReadonlyArray<Session>> {
  return Promise.all(Array.from({ length: users }, (_, n) => openSession(config.baseUrl, `user-${n + 1}`, config.adminEmail, config.adminPassword)));
}

function sessionOf(sessions: ReadonlyArray<Session>, user: number): Session {
  const session = sessions[user];
  if (session === undefined) throw new Error(`there is no session for virtual user ${user}`);
  return session;
}

function partOf(parts: ReadonlyArray<PartRef>, index: number): PartRef {
  const part = parts[index % parts.length];
  if (part === undefined) throw new Error('the estimate has no parts');
  return part;
}

/** The page-data reads of NFR-010 (AC-1): the queue, the tree, the part form and the cost details of one part, each as the page asks for it. */
function readLines(ctx: WorldContext, sessions: ReadonlyArray<Session>): ReadonlyArray<LoadLine> {
  const { estimateA, partsA } = ctx.world;
  const line = (name: string, path: (user: number, round: number) => string): LoadLine => ({
    name,
    expectedStatus: OK,
    request: (user, round) => call(sessionOf(sessions, user), 'GET', path(user, round)),
  });
  return [
    line('queue', () => '/api/v1/tasks?tab=open'),
    line('tree', () => `/api/v1/estimates/${estimateA}/tree`),
    line('part form', () => `/api/v1/estimates/${estimateA}/form`),
    line('cost details', (user, round) => `/api/v1/estimates/${estimateA}/nodes/${partOf(partsA, (user + round) % COST_NODES_CYCLED).id}/costs`),
  ];
}

/** The part save: user `n` writes a part of its own in estimate `n mod k` of B1 to Bk, as the part was when the user last looked, with a quantity that changes every round. */
function saveLine(ctx: WorldContext, sessions: ReadonlyArray<Session>): LoadLine {
  const { saveTargets } = ctx.world;
  const quantityField = fieldIdOf('qty-per-assy');
  return {
    name: 'part save',
    expectedStatus: OK,
    request: async (user, round): Promise<Reply> => {
      const target = saveTargets[user % saveTargets.length];
      if (target === undefined) throw new Error('there is no estimate to save into');
      const part = partOf(target.parts, Math.floor(user / saveTargets.length));
      const revision = ctx.revisions.get(part.id) ?? part.revision;
      const reply = await call(sessionOf(sessions, user), 'PATCH', `/api/v1/estimates/${target.estimateId}/nodes/${part.id}/inputs`, {
        json: { revision, values: { [quantityField]: quantityFor(user, round) } },
      });
      const saved = reply.status === OK ? jsonOf(reply) : undefined;
      if (typeof saved === 'object' && saved !== null && 'revision' in saved && typeof saved.revision === 'number') ctx.revisions.set(part.id, saved.revision);
      return reply;
    },
  };
}

function plan(ctx: Context, users: number, thinkMs = ctx.config.thinkMs): Parameters<typeof runClosedLoop>[0] {
  return { users, rounds: ctx.config.requestsPerLine, warmupRounds: warmupRoundsFor(users), thinkMs };
}

function limits(names: ReadonlyArray<string>, limitMs: number): ReadonlyMap<string, number> {
  return new Map(names.map((name) => [name, limitMs]));
}

/** NFR-010 and NFR-011 at the given load: the AC-1 lines judged at 500 ms, the estimate-level cost read reported (it answers the whole review's figures). */
async function runMix(ctx: WorldContext, users: number, phase: string, judged: boolean): Promise<PhaseResult> {
  const sessions = await openSessions(ctx.config, users);
  const extra: LoadLine = {
    name: 'costs (review, extra)',
    expectedStatus: OK,
    request: (user) => call(sessionOf(sessions, user), 'GET', `/api/v1/estimates/${ctx.world.estimateA}/costs`),
  };
  const lines = [...readLines(ctx, sessions), saveLine(ctx, sessions), extra];
  const started = performance.now();
  const results = await runClosedLoop(plan(ctx, users), lines);
  const seconds = (performance.now() - started) / 1_000;
  const summaries = results.map(summariseLine);
  const treeBytes = summaries.find((summary) => summary.name === 'tree')?.answerBytes ?? null;
  const notes = [
    `${users} virtual users, ${ctx.config.requestsPerLine} counted requests per line each, think time ${ctx.config.thinkMs} ms, wall time ${seconds.toFixed(0)} s`,
    `the part saves went to ${ctx.world.saveTargets.length} estimates of ${ctx.config.parts} parts, each user to a part of its own`,
  ];
  if (treeBytes !== null) notes.push(`the tree answer of the ${ctx.world.partsA.length}-part estimate is ${(treeBytes / 1024).toFixed(1)} KB (decoded)`);
  return { phase, summaries, limitsMs: judged ? limits(['queue', 'tree', 'part form', 'cost details', 'part save'], NFR_010_LINE_MS) : new Map(), reportOnly: !judged, notes };
}

export const runMixLow = (ctx: WorldContext): Promise<PhaseResult> => runMix(ctx, ctx.config.usersLow, `NFR-010, ${ctx.config.usersLow} users (page reads and the part save)`, true);
export const runMixHigh = (ctx: WorldContext): Promise<PhaseResult> => runMix(ctx, ctx.config.usersHigh, `NFR-011, ${ctx.config.usersHigh} users (capacity)`, false);

/** Section 8.1 (a) and (b), then (e) saturation. The size and the p50 and the maximum, (d), are columns of the table. */
export async function runVolume(ctx: Context): Promise<ReadonlyArray<PhaseResult>> {
  const users = ctx.config.usersLow;
  const sessions = await openSessions(ctx.config, users);
  const ids = ctx.masters.customers.map((customer) => customer.id);
  const lines: ReadonlyArray<LoadLine> = [
    { name: 'customers list', expectedStatus: OK, request: (user) => call(sessionOf(sessions, user), 'GET', '/api/v1/customers') },
    {
      name: 'one customer (page)',
      expectedStatus: OK,
      // Every customer in turn: with 25 users and 41 rounds the reads go round all 500.
      request: (user, round) => call(sessionOf(sessions, user), 'GET', `/masters/customers/${ids[(round * users + user) % ids.length] ?? ''}`),
    },
  ];
  const judged = await runClosedLoop(plan(ctx, users), lines);
  const started = performance.now();
  const saturated = await runClosedLoop(plan(ctx, users, 0), lines);
  const seconds = (performance.now() - started) / 1_000;
  const requests = saturated.reduce((sum, result) => sum + result.samples.length, 0);
  return [
    {
      phase: `NFR-011, ${ctx.config.customers} customers x ${ctx.config.processItemsTotal} rates (section 8.1 a, b)`,
      summaries: judged.map(summariseLine),
      limitsMs: limits(['customers list', 'one customer (page)'], NFR_010_LINE_MS),
    },
    {
      phase: `NFR-011, ${SATURATION_USERS_NOTE} (section 8.1 e)`,
      summaries: saturated.map(summariseLine),
      limitsMs: new Map(),
      reportOnly: true,
      notes: [`${requests} requests in ${seconds.toFixed(1)} s: ${(requests / seconds).toFixed(1)} requests a second at ${users} users`],
    },
  ];
}

/**
 * AC-4: the 25-user page reads while 500-part exports run back to back; only the requests that left while an export was running are counted. At least `exportRuns` exports run, and exports go on until
 * `exportMinSeconds` have passed, so the window holds enough requests for a p95 (an export of parts with few pictures is over in a second or two). The exports themselves are a reported line: their
 * times, and any answer other than 200 (the export thread is stopped at 120 s, which would show here), which is an error and fails the job.
 */
export async function runExport(ctx: WorldContext): Promise<PhaseResult> {
  const users = ctx.config.usersLow;
  const sessions = await openSessions(ctx.config, users);
  const [exporter] = await openSessions(ctx.config, 1);
  if (exporter === undefined) throw new Error('there is no session for the export');
  const exportSamples: Sample[] = [];
  let exporting = true;
  const windowStart = performance.now();
  const exports = (async (): Promise<void> => {
    const minimumEnd = windowStart + ctx.config.exportMinSeconds * 1_000;
    for (let run = 0; run < ctx.config.exportRuns || performance.now() < minimumEnd; run += 1) {
      const reply = await call(exporter, 'GET', `/api/v1/estimates/${ctx.world.estimateA}/export`);
      exportSamples.push({ ms: reply.ms, status: reply.status, bytes: reply.bytes, startedAt: reply.startedAt });
    }
    exporting = false;
  })();
  const loop = await runClosedLoop({ users, rounds: 1_000, warmupRounds: 0, thinkMs: ctx.config.thinkMs, stopWhen: () => !exporting }, readLines(ctx, sessions));
  await exports;
  const windowEnd = performance.now();
  const inside: ReadonlyArray<LineSamples> = withinWindow(loop, windowStart, windowEnd);
  const exportLine: LoadLine = { name: 'export (reported)', expectedStatus: OK, request: () => Promise.reject(new Error('not used')) };
  const exportSummary = summariseLine({ line: exportLine, samples: exportSamples });
  return {
    phase: `NFR-010, ${users} users while a ${ctx.world.partsA.length}-part export runs (AC-4)`,
    summaries: [...inside.map(summariseLine), exportSummary],
    limitsMs: limits(['queue', 'tree', 'part form', 'cost details'], NFR_010_LINE_MS),
    notes: [
      `${exportSamples.length} export(s) of ${ctx.world.partsA.length} parts (${ctx.config.exportPictures} with a picture of 199 KB) ran one after another for ${((windowEnd - windowStart) / 1_000).toFixed(0)} s`,
      'only the requests that left while an export was running are counted',
    ],
  };
}

/** AC-2: 2 warm-up changes, then `passwordRuns` in series, alternating between two invented passwords. Judged on the production host; on the CI runner it is reported against the line. */
export async function runPassword(ctx: WorldContext, reportOnly: boolean): Promise<PhaseResult> {
  const { engineer } = ctx.world;
  const { passwordA, passwordB, passwordRuns } = ctx.config;
  const samples: Array<{ ms: number; status: number; bytes: number; startedAt: number }> = [];
  for (let n = 0; n < PASSWORD_WARMUP_CHANGES + passwordRuns; n += 1) {
    const reply = await changeOwnPassword(engineer, engineer.current === passwordA ? passwordB : passwordA);
    if (n >= PASSWORD_WARMUP_CHANGES) samples.push({ ms: reply.ms, status: reply.status, bytes: reply.bytes, startedAt: reply.startedAt });
  }
  const line: LoadLine = { name: 'own-password change', expectedStatus: NO_CONTENT, request: () => Promise.reject(new Error('not used')) };
  return {
    phase: `NFR-010, own-password change, ${passwordRuns} in series (AC-2)`,
    summaries: [summariseLine({ line, samples })],
    limitsMs: limits([line.name], OWN_PASSWORD_LINE_MS),
    reportOnly,
    notes: [reportOnly ? 'reported against the 1,000 ms line: the CI runner is not the production host (OQ-3)' : 'judged against the 1,000 ms line'],
  };
}
