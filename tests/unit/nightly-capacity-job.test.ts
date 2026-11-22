import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STORY-10.09 AC-9 and AC-10: the nightly job "Capacity and latency (NFR-010, NFR-011)". The workflow cannot run in a unit test, so these read its text. A fault here is silent: a job that
 * cannot fail, one that lengthens the required check, or one that runs against stage 12's database would be noticed only on a runner, in a public log.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (relative: string): string => readFileSync(`${ROOT}${relative}`, 'utf8').replaceAll('\r\n', '\n');
const LINES = read('.github/workflows/nightly.yml').split('\n');

function jobOf(id: string): string {
  const start = LINES.findIndex((line) => line === `  ${id}:`);
  if (start === -1) throw new Error(`No job "${id}"`);
  const rest = LINES.slice(start + 1);
  const end = rest.findIndex((line) => /^ {2}[\w-]+:\s*$/.test(line));
  return [LINES[start] ?? '', ...(end === -1 ? rest : rest.slice(0, end))].join('\n');
}

const JOB = jobOf('capacity');
const JOB_CODE = JOB.split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n');

function stepOf(prefix: string): string {
  const lines = JOB.split('\n');
  const start = lines.findIndex((line) => line.includes(`- name: ${prefix}`) || line.includes(`- name: "${prefix}`));
  if (start === -1) throw new Error(`No step named "${prefix}..."`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^\s*- name:/.test(line));
  return [lines[start] ?? '', ...(end === -1 ? rest : rest.slice(0, end))].join('\n');
}

describe('AC-9: the job exists under its name, on the reference runner, with a Postgres service of its own', () => {
  it('is named "Capacity and latency (NFR-010, NFR-011)" and has a time limit', () => {
    expect(JOB).toMatch(/^ {4}name: Capacity and latency \(NFR-010, NFR-011\)$/m);
    expect(JOB).toMatch(/^ {4}timeout-minutes: \d+$/m);
  });

  it('runs on ubuntu-24.04, the runner of test strategy 10.2', () => {
    expect(JOB).toMatch(/^ {4}runs-on: ubuntu-24\.04$/m);
  });

  it('has a Postgres service pinned by the same digest as the Lighthouse job, and makes its own roles and its own throwaway passwords', () => {
    const image = /image: (postgres:17@sha256:[0-9a-f]{64})/.exec(JOB)?.[1];
    expect(image).toBeDefined();
    expect(jobOf('lighthouse')).toContain(`image: ${image ?? ''}`);
    expect(stepOf('Create the database roles')).toMatch(/openssl rand[\s\S]*::add-mask::[\s\S]*01-create-roles\.sh[\s\S]*prisma migrate deploy/);
  });
});

describe('AC-9: the required check is not lengthened and a breach fails this job only', () => {
  it('has no `needs`, so it waits for no other job and no other job waits for it', () => {
    expect(JOB_CODE).not.toMatch(/^\s*needs:/m);
    for (const line of LINES) expect(line).not.toMatch(/needs:.*capacity/);
  });

  it('cannot hide a breach: no continue-on-error anywhere in the job, and the load step is not conditional', () => {
    expect(JOB_CODE).not.toContain('continue-on-error');
    expect(stepOf('Load, capacity and volume run')).not.toMatch(/^\s+if:/m);
  });

  it('is not the required check "Stages 1 to 11" and does not take its name', () => {
    expect(JOB).not.toContain('Stages 1 to 11');
    expect(read('.github/workflows/ci.yml')).not.toContain('capacity-report');
  });
});

describe('AC-9: it measures the production build, with the export thread, through the load script', () => {
  it('stores the seed configuration version, builds with `npm run build` (which also bundles the export thread) and serves with `next start` in production mode', () => {
    expect(stepOf('Store the seed configuration version')).toContain('node --conditions=react-server --import tsx scripts/ensure-seed-version.ts');
    expect(stepOf('Build')).toContain('npm run build');
    expect(read('package.json')).toMatch(/"build": "prisma generate && next build && tsx scripts\/build-export-worker\.ts"/);
    const start = stepOf('Start the production server');
    expect(start).toContain('NODE_ENV=production');
    expect(start).toContain('next start --port 3000');
    expect(start).toMatch(/APP_ORIGIN="\$\{LOAD_BASE_URL\}"/);
  });

  it('runs tests/perf/load-25-50.ts with the react-server condition, reports the own-password line only (the runner is not the host), and writes a report file', () => {
    const step = stepOf('Load, capacity and volume run');
    expect(step).toContain('node --conditions=react-server --import tsx tests/perf/load-25-50.ts');
    expect(step).toContain("LOAD_PASSWORD_REPORT_ONLY: '1'");
    expect(step).toContain('LOAD_REPORT_FILE:');
    expect(existsSync(`${ROOT}tests/perf/load-25-50.ts`)).toBe(true);
  });

  it('keeps the report for 30 days even when the run failed, and uploads nothing to a public server', () => {
    const step = stepOf('Keep the report for 30 days');
    expect(step).toContain('if: ${{ !cancelled() }}');
    expect(step).toContain('retention-days: 30');
    expect(step).toContain('name: capacity-report');
  });
});

describe('AC-10: an invented Admin, a password made in the job and masked, and no load tool added', () => {
  it('makes the Admin\'s password in the job, masks it, and hands it over through the environment only', () => {
    const step = stepOf('Make the invented Admin');
    expect(step).toMatch(/openssl rand[\s\S]*::add-mask::/);
    expect(step).toContain('MEASUREMENT_ADMIN_PASSWORD=');
    expect(step).toContain('load-admin@example.test');
  });

  it('adds no load-testing tool to the dependencies (A-1: the Node script, no k6)', () => {
    const manifest = JSON.parse(read('package.json')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const names = [...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {})];
    for (const tool of ['k6', 'autocannon', 'artillery', 'loadtest', 'wrk']) expect(names).not.toContain(tool);
  });
});
