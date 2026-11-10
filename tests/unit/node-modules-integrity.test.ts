import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * AQP-243 (STORY-10.19) AC-3 (a), (b): scripts/ci/node-modules-integrity.sh is the check that a restored `node_modules` is the
 * one `npm ci` made. `record` writes a list of the files and their sizes; `check` compares the restored directory with it. The
 * check must pass on an intact directory and fail on a missing package, a truncated file, an extra file, a missing or damaged
 * record, and a listing that runs past its time limit. A failed check is what sends the job to the clean-install fallback.
 *
 * Every scenario runs once, in `beforeAll`, under the shared hook limit (vitest.config.ts, DL-057), all at the same time, and the
 * tests read the recorded outcomes: starting a bash is slow on a Windows checkout (QLT-80), and that cost belongs in a hook, not
 * in a test with the 5 s test limit. The live controls on a throwaway pull request (the Dev Record) prove the same on a runner.
 */

const SCRIPT = fileURLToPath(new URL('../../scripts/ci/node-modules-integrity.sh', import.meta.url));
const BASH_AVAILABLE = spawnSync('bash', ['--version']).error === undefined;
/** Bash on Windows reads a backslash as an escape, so every path given to it uses forward slashes. */
const posix = (path: string): string => path.split('\\').join('/');

interface Outcome {
  readonly status: number | null;
  readonly output: string;
  /** How long the run took, in milliseconds. */
  readonly elapsedMs: number;
}

type Damage = 'none' | 'missing package' | 'truncated file' | 'extra file' | 'no record' | 'damaged record' | 'empty record' | 'not a directory';

/** A small `node_modules`: three packages (one scoped), a `.bin` entry and a nested dependency. */
function makeModules(root: string): string {
  const modules = join(root, 'node_modules');
  const files: Record<string, string> = {
    'alpha/package.json': '{"name":"alpha","version":"1.0.0","main":"index.js"}',
    'alpha/index.js': 'module.exports = "alpha";\n'.repeat(20),
    'beta/package.json': '{"name":"beta","version":"2.1.0","main":"lib/main.js"}',
    'beta/lib/main.js': 'exports.beta = () => 42;\n'.repeat(30),
    '@scope/gamma/package.json': '{"name":"@scope/gamma","version":"0.3.0"}',
    '@scope/gamma/dist/gamma.js': 'export const gamma = 1;\n'.repeat(15),
    'beta/node_modules/delta/package.json': '{"name":"delta","version":"9.9.9"}',
    '.bin/alpha': '#!/usr/bin/env node\nrequire("../alpha");\n',
  };
  for (const [name, text] of Object.entries(files)) {
    const path = join(modules, name);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, text);
  }
  return modules;
}

function run(mode: string, modules: string, extra: Record<string, string> = {}): Promise<Outcome> {
  const started = performance.now();
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [posix(SCRIPT), mode], { env: { ...process.env, NODE_MODULES_DIR: posix(modules), ...extra } });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) {
      stream.on('data', (chunk: Buffer) => {
        output += chunk.toString('utf8');
      });
    }
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, output, elapsedMs: performance.now() - started }));
  });
}

/** Records an intact directory, damages it as asked, and checks it. */
async function scenario(root: string, damage: Damage, extra: Record<string, string> = {}): Promise<Outcome> {
  const modules = makeModules(root);
  const recorded = await run('record', modules);
  if (recorded.status !== 0) throw new Error(`record failed: ${recorded.output}`);
  switch (damage) {
    case 'missing package':
      rmSync(join(modules, 'beta', 'lib'), { recursive: true });
      break;
    case 'truncated file':
      truncateSync(join(modules, '@scope', 'gamma', 'dist', 'gamma.js'), 40);
      break;
    case 'extra file':
      appendFileSync(join(modules, 'alpha', 'extra.js'), 'x');
      break;
    case 'no record':
      rmSync(join(modules, '.ci-integrity'));
      break;
    case 'damaged record':
      writeFileSync(join(modules, '.ci-integrity'), '8 0000000000000000000000000000000000000000000000000000000000000000\n');
      break;
    case 'empty record':
      writeFileSync(join(modules, '.ci-integrity'), '');
      break;
    case 'not a directory':
      rmSync(modules, { recursive: true });
      break;
    case 'none':
      break;
  }
  return run('check', modules, extra);
}

describe.skipIf(!BASH_AVAILABLE)('AQP-243 AC-3: the node_modules integrity check, run in bash', () => {
  const root = mkdtempSync(join(tmpdir(), 'node-modules-integrity-'));
  const outcomes = new Map<string, Outcome>();
  const outcome = (name: string): Outcome => {
    const found = outcomes.get(name);
    if (found === undefined) throw new Error(`No outcome recorded for ${name}`);
    return found;
  };
  let recordedText = '';
  let secondRecordText = '';
  let wrongMode: Outcome | undefined;
  let recordMissing: Outcome | undefined;

  beforeAll(async () => {
    const damages: Damage[] = ['none', 'missing package', 'truncated file', 'extra file', 'no record', 'damaged record', 'empty record', 'not a directory'];
    const results = await Promise.all(damages.map((damage, index) => scenario(join(root, `s${index}`), damage)));
    damages.forEach((damage, index) => {
      const result = results[index];
      if (result !== undefined) outcomes.set(damage, result);
    });

    // A listing that runs past the limit: a fake `find` that sleeps, first on the PATH, and a limit of 1 s.
    const fakeBin = join(root, 'fake-bin');
    mkdirSync(fakeBin, { recursive: true });
    writeFileSync(join(fakeBin, 'find'), '#!/usr/bin/env bash\nexec sleep 30\n');
    chmodSync(join(fakeBin, 'find'), 0o755);
    outcomes.set('slow listing', await scenario(join(root, 'slow'), 'none', { PATH: `${posix(fakeBin)}:${process.env['PATH'] ?? ''}`, INTEGRITY_TIMEOUT: '1' }));

    // The record is stable: the record file is not in its own list, so recording twice gives the same text.
    const stable = makeModules(join(root, 'stable'));
    await run('record', stable);
    recordedText = readFileSync(join(stable, '.ci-integrity'), 'utf8');
    await run('record', stable);
    secondRecordText = readFileSync(join(stable, '.ci-integrity'), 'utf8');
    wrongMode = await run('verify', stable);
    recordMissing = await run('record', join(root, 'nothing-here', 'node_modules'));
  }, 120_000);

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('passes on an intact directory, right after the record', () => {
    expect(outcome('none').status).toBe(0);
    expect(outcome('none').output).toContain('node_modules integrity check passed: 8 files');
  });

  it('fails when a package is missing, and says why', () => {
    expect(outcome('missing package').status).toBe(1);
    expect(outcome('missing package').output).toContain('node_modules integrity check failed');
  });

  it('fails when a file is truncated (the same name with fewer bytes)', () => {
    expect(outcome('truncated file').status).toBe(1);
  });

  it('fails when a file is added: the restored directory is not the recorded one', () => {
    expect(outcome('extra file').status).toBe(1);
  });

  it('fails when the record is missing, wrong or empty, so an entry saved without a record can only fall back', () => {
    expect(outcome('no record').status).toBe(1);
    expect(outcome('no record').output).toContain('no record');
    expect(outcome('damaged record').status).toBe(1);
    expect(outcome('empty record').status).toBe(1);
  });

  it('fails when there is no directory at all', () => {
    expect(outcome('not a directory').status).toBe(1);
  });

  it('fails when the listing runs past its time limit, and does not wait for it', () => {
    expect(outcome('slow listing').status).toBe(1);
    // The fake listing sleeps 30 s; with the 1 s limit the check ends long before that (a missing bound would take 30 s).
    expect(outcome('slow listing').elapsedMs).toBeLessThan(15_000);
    expect(outcome('slow listing').output).toContain('could not be listed within 1 s');
  });

  it('records the same text twice, because the record is not part of its own list', () => {
    expect(recordedText).toMatch(/^8 [0-9a-f]{64}\n$/);
    expect(secondRecordText).toBe(recordedText);
  });

  it('refuses an unknown mode and a record of a directory that does not exist', () => {
    expect(wrongMode?.status).toBe(2);
    expect(recordMissing?.status).toBe(1);
  });
});
