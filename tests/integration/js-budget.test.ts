import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { LimitEntry } from '../../scripts/lib/js-budget';
import type { RouteRow } from '../../scripts/lib/js-budget-check';
import { runBudgetCheck } from '../../scripts/lib/js-budget-run';
import {
  STUB_EMAIL,
  STUB_CUSTOMER_ID,
  STUB_PASSWORD,
  createStubBuild,
  incompressible,
  pageNaming,
  startStubPortal,
  type StubBuild,
  type StubPage,
  type StubPortal,
} from '../support/stub-portal';

/**
 * STORY-10.10 T3 (AC-2): the check against a small fixture build directory and a stub server, not a full `next build`
 * inside Vitest. A route over its limit fails, a route answering 500 fails, an unreachable route fails, nothing is
 * skipped, and the `not-found` row passes on 404 and fails on 200. The planted overrun is the negative control: the
 * same healthy fixture passes, and the same fixture with one oversized chunk fails against the real 200,000-byte limit.
 * The runs happen in hooks and the tests read what they recorded (test strategy section 10).
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const APP_PATHS = ['/(portal)/page', '/(portal)/account/page', '/(portal)/queue/page', '/(portal)/design-system/page', '/(portal)/users/page', '/(portal)/audit/page', '/(portal)/masters/materials/page', '/(portal)/masters/process/page', '/(public)/sign-in/page', '/_not-found/page', '/api/auth/[...nextauth]/route'];
const OVERRUN_BYTES = 210_000;
const LIMIT = 200_000;

const small = 'console.log("shell");\n'.repeat(1_000);
const STATIC_FILES = { 'chunks/shell.js': small, 'chunks/queue.js': 'console.log("queue");\n'.repeat(500), 'chunks/huge.js': incompressible(OVERRUN_BYTES) };
const NOT_FOUND = pageNaming('shell.js');

const healthyPages = (): Record<string, StubPage> => ({
  '/': { signedIn: { status: 200, html: pageNaming('shell.js') } },
  '/account': { signedIn: { status: 200, html: pageNaming('shell.js') } },
  '/queue': { signedIn: { status: 200, html: pageNaming('shell.js', 'queue.js') } },
  '/users': { signedIn: { status: 200, html: pageNaming('shell.js') } },
  '/audit': { signedIn: { status: 200, html: pageNaming('shell.js') } },
  '/masters/customers': { signedIn: { status: 200, html: pageNaming('shell.js') } },
  [`/masters/customers/${STUB_CUSTOMER_ID}`]: { signedIn: { status: 200, html: pageNaming('shell.js') } },
  '/masters/materials': { signedIn: { status: 200, html: pageNaming('shell.js') } },
  '/masters/process': { signedIn: { status: 200, html: pageNaming('shell.js') } },
  '/design-system': { signedIn: { status: 404, html: NOT_FOUND } },
  '/sign-in': { anonymous: { status: 200, html: pageNaming('shell.js') }, signedIn: { status: 307 } },
});

const credentialsFor = (role: string) => (role === 'ADMIN' ? { email: STUB_EMAIL, password: STUB_PASSWORD } : undefined);

interface Scenario {
  readonly rows: ReadonlyArray<RouteRow>;
}

let build: StubBuild;
const portals: StubPortal[] = [];

async function runAgainst(pages: Record<string, StubPage>, notFound = NOT_FOUND, limits?: Readonly<Record<string, LimitEntry>>): Promise<Scenario> {
  const portal = await startStubPortal(pages, notFound);
  portals.push(portal);
  return { rows: await runBudgetCheck({ buildDir: build.directory, baseUrl: portal.baseUrl, credentialsFor, limits: limits ?? {} }) };
}

const byRoute = (scenario: Scenario, route: string): RouteRow | undefined => scenario.rows.find((row) => row.route === route);

let healthy: Scenario;
let planted: Scenario;
let loweredLimit: Scenario;
let serverError: Scenario;
let notFoundAnswers200: Scenario;
let hiddenIsServed: Scenario;
let unreachable: Scenario;

beforeAll(async () => {
  build = createStubBuild(STATIC_FILES, APP_PATHS);
  healthy = await runAgainst(healthyPages());
  planted = await runAgainst({ ...healthyPages(), '/queue': { signedIn: { status: 200, html: pageNaming('shell.js', 'huge.js') } } });
  loweredLimit = await runAgainst(healthyPages(), NOT_FOUND, {
    '/queue': { limitBytes: 100, decision: 'DL-999', lighthouseRun: 'invented-run', lighthouseResult: 'missed' },
  });
  serverError = await runAgainst({ ...healthyPages(), '/queue': { signedIn: { status: 500, html: 'Internal Server Error' } } });
  notFoundAnswers200 = await runAgainst({ ...healthyPages(), '/nfr-009-unused-path': { signedIn: { status: 200, html: NOT_FOUND } } });
  hiddenIsServed = await runAgainst({ ...healthyPages(), '/design-system': { signedIn: { status: 200, html: pageNaming('shell.js') } } });
  const closed = await startStubPortal({}, NOT_FOUND);
  await closed.close();
  unreachable = { rows: await runBudgetCheck({ buildDir: build.directory, baseUrl: closed.baseUrl, credentialsFor }) };
});

afterAll(async () => {
  await Promise.all(portals.map((portal) => portal.close()));
  build.cleanup();
});

describe('the check against a stub portal and a fixture build', () => {
  it('passes a healthy build: every route and the not-found page are measured or accounted for', () => {
    expect(healthy.rows.map((row) => [row.route, row.ok])).toEqual([
      ['/', true],
      ['/account', true],
      ['/audit', true],
      ['/design-system', true],
      ['/masters/materials', true],
      ['/masters/process', true],
      ['/queue', true],
      ['/sign-in', true],
      ['/users', true],
      ['not-found', true],
    ]);
    expect(byRoute(healthy, '/queue')).toMatchObject({ viewer: 'ADMIN', files: 2, limit: LIMIT });
    expect(byRoute(healthy, '/sign-in')).toMatchObject({ viewer: 'anonymous', files: 1 });
    expect(byRoute(healthy, 'not-found')).toMatchObject({ viewer: 'ADMIN', files: 1 });
  });

  it('negative control: one oversized chunk on one route fails that route against the real limit and no other', () => {
    const queue = byRoute(planted, '/queue');
    expect(queue?.ok).toBe(false);
    expect(queue?.gzipBytes).toBeGreaterThan(LIMIT);
    expect(queue?.note).toMatch(/^over its limit by [\d,]+ bytes$/);
    expect(planted.rows.filter((row) => !row.ok).map((row) => row.route)).toEqual(['/queue']);
  });

  it('negative control: a limit lowered below a route fails that route and says so, though the page is unchanged', () => {
    expect(byRoute(loweredLimit, '/queue')).toMatchObject({ ok: false, limit: 100 });
    expect(byRoute(loweredLimit, '/')).toMatchObject({ ok: true, limit: LIMIT });
  });

  it('fails a route that answers 500, names it, and still reports every other route', () => {
    expect(byRoute(serverError, '/queue')).toMatchObject({ ok: false, note: 'ADMIN got HTTP 500, not HTTP 200' });
    expect(serverError.rows).toHaveLength(10);
    expect(byRoute(serverError, '/')?.ok).toBe(true);
  });

  it('passes the not-found row on 404 and fails it on 200', () => {
    expect(byRoute(healthy, 'not-found')?.ok).toBe(true);
    expect(byRoute(notFoundAnswers200, 'not-found')).toMatchObject({ ok: false, note: 'ADMIN got HTTP 200, not HTTP 404' });
  });

  it('fails a route that is meant to be hidden in production but is served', () => {
    expect(byRoute(hiddenIsServed, '/design-system')).toMatchObject({ ok: false, note: 'ADMIN got HTTP 200, not HTTP 404' });
  });

  it('fails every route when the server cannot be reached, skipping none', () => {
    expect(unreachable.rows).toHaveLength(10);
    for (const row of unreachable.rows) {
      expect(row.ok).toBe(false);
      expect(row.note).toContain('the request did not complete');
    }
  });
});

describe('the entry point scripts/check-js-budget.ts', () => {
  interface CliRun {
    readonly code: number | null;
    readonly output: string;
    readonly summary: string;
  }

  /** What the TypeScript runner needs from the machine to start; nothing else is passed on. */
  const passedThrough = (): Record<string, string> =>
    Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'HOME', 'USERPROFILE'].flatMap((name) => (process.env[name] === undefined ? [] : [[name, process.env[name]]])));

  function runScript(baseUrl: string, buildDir: string, summaryFile: string, withCredentials: boolean, makeRecords = false): Promise<CliRun> {
    return new Promise((resolve, reject) => {
      const credentials = withCredentials ? { MEASUREMENT_ADMIN_EMAIL: STUB_EMAIL, MEASUREMENT_ADMIN_PASSWORD: STUB_PASSWORD } : {};
      const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/check-js-budget.ts', '--build-dir', buildDir, '--base-url', baseUrl, ...(makeRecords ? ['--make-records'] : [])], {
        cwd: ROOT,
        env: { NODE_ENV: 'test', ...passedThrough(), GITHUB_STEP_SUMMARY: summaryFile, ...credentials },
      });
      let output = '';
      child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
      child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
      child.on('error', reject);
      child.on('close', (code) => {
        let summary = '';
        try {
          summary = readFileSync(summaryFile, 'utf8');
        } catch {
          // No summary file: the run stopped before writing one.
        }
        resolve({ code, output, summary });
      });
    });
  }

  let scratch: string;
  let passing: CliRun;
  let overrun: CliRun;
  let noCredentials: CliRun;
  let noRecords: CliRun;
  let noRecordsAdded = -1;
  let recordsAdded = -1;

  beforeAll(async () => {
    scratch = mkdtempSync(join(tmpdir(), 'js-budget-cli-'));
    const good = await startStubPortal(healthyPages(), NOT_FOUND);
    const over = await startStubPortal({ ...healthyPages(), '/queue': { signedIn: { status: 200, html: pageNaming('shell.js', 'huge.js') } } }, NOT_FOUND);
    portals.push(good, over);
    passing = await runScript(good.baseUrl, build.directory, join(scratch, 'pass.md'), true, true);
    overrun = await runScript(over.baseUrl, build.directory, join(scratch, 'over.md'), true, true);
    noCredentials = await runScript(good.baseUrl, build.directory, join(scratch, 'none.md'), false);
    const readOnly = await startStubPortal(healthyPages(), NOT_FOUND);
    portals.push(readOnly);
    noRecords = await runScript(readOnly.baseUrl, build.directory, join(scratch, 'read-only.md'), true);
    noRecordsAdded = readOnly.customersAdded();
    recordsAdded = good.customersAdded();
  });

  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  it('exits 0 for a healthy build and writes one row per route to the job summary', () => {
    expect(passing.code).toBe(0);
    expect(passing.summary).toContain('### JS budget (NFR-009)');
    expect(passing.summary).toContain('| Route | Result | Viewer | Files | Raw bytes | Gzip bytes | Limit | Headroom | Note |');
    for (const route of ['/', '/account', '/audit', '/design-system', '/masters/customers', '/masters/customers/[id]', '/masters/materials', '/masters/process', '/queue', '/sign-in', '/users', 'not-found']) expect(passing.summary).toContain(`| ${route} | pass |`);
    expect(passing.summary).toContain('all 12 rows are within their limit');
  });

  it('exits 1 for a planted overrun, and the summary and the log name the route', () => {
    expect(overrun.code).toBe(1);
    expect(overrun.summary).toMatch(/\| \/queue \| FAIL \|/);
    expect(overrun.output).toContain('FAIL  /queue');
    expect(overrun.output).toContain('1 of 12 rows failed');
  });

  it('fails the routes that need sign-in, and says why, when no credentials were provided; it never prints a credential', () => {
    expect(noCredentials.code).toBe(1);
    expect(noCredentials.output).toContain('no credentials were provided for the role ADMIN');
    expect(noCredentials.output).toContain('/queue: the route manifest allows ADMIN, LEAD, ENGINEER on it, but the check has no sign-in for any of those roles');
    expect(`${noCredentials.output}${noCredentials.summary}${passing.output}${passing.summary}`).not.toContain(STUB_PASSWORD);
  });

  it('writes nothing to a server it did not start unless --make-records is given (QLT-05): one customer with the flag, none without, and the dynamic route says why it failed', () => {
    expect(recordsAdded).toBe(1);
    expect(noRecordsAdded).toBe(0);
    expect(noRecords.code).toBe(1);
    expect(noRecords.output).toContain('/masters/customers/[id]');
    expect(noRecords.output).toContain('a dynamic segment needs a record made from invented data, and none could be made');
    expect(noRecords.output).toContain('1 of 12 rows failed');
  });
});
