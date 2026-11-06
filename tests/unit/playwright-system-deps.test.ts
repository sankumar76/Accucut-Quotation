import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { posix, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * DEF-015 (AQP-206), test strategy 10.6: scripts/ci/playwright-system-deps.sh installs the browser's system packages
 * from a cache without a network, falls back to a bounded normal install when the cache is empty or bad, and keeps
 * what that install downloaded. The script runs here against fake `sudo`, `dpkg` and `npx` programs that log their
 * calls, so no package is installed and nothing is downloaded. The real apt run is shown by the CI logs.
 *
 * Every scenario runs once, in `beforeAll`, under the shared hook limit (vitest.config.ts, DL-057), and the tests read
 * the recorded outcomes. Each scenario starts a bash and several fake programs, which is slow on a Windows checkout
 * (QLT-80), and that cost belongs in a hook, not in a test with the 5 s test limit.
 */

const SCRIPT = fileURLToPath(new URL('../../scripts/ci/playwright-system-deps.sh', import.meta.url));
const BASH_AVAILABLE = spawnSync('bash', ['--version']).error === undefined;
// posix.join keeps forward slashes on Windows too: bash there reads a backslash in a glob as an escape.
const join = posix.join;

const CACHE_KEY = 'playwright-debs-e1-ubuntu99-20990101.1.1-9.9.9';

interface Scenario {
  readonly cacheHit: 'true' | 'false';
  /** Files already in the cache directory when the script starts. */
  readonly cached?: ReadonlyArray<string>;
  /** Exit status of `dpkg -i`. */
  readonly dpkgExit?: number;
  /** Exit status of `npx playwright install-deps` only; the browser install after it always succeeds. */
  readonly installDepsExit?: number;
}

interface Outcome {
  readonly status: number | null;
  readonly output: string;
  readonly calls: ReadonlyArray<string>;
  readonly boundsFile: string | null;
  readonly cachedAfter: ReadonlyArray<string>;
  /** Files the script left in its temporary directory. */
  readonly leftover: ReadonlyArray<string>;
}

const SCENARIOS = {
  hit: { cacheHit: 'true', cached: ['libfoo.deb'] },
  miss: { cacheHit: 'false' },
  badHit: { cacheHit: 'true', cached: ['corrupt.deb'], dpkgExit: 1 },
  emptyHit: { cacheHit: 'true', cached: [] },
  // Only the system-package install fails, so the browser install after it would succeed: only `set -e` can stop the step.
  failedInstall: { cacheHit: 'false', installDepsExit: 1 },
} satisfies Record<string, Scenario>;

type ScenarioName = keyof typeof SCENARIOS;

describe.skipIf(!BASH_AVAILABLE)('scripts/ci/playwright-system-deps.sh', () => {
  const roots: string[] = [];
  const outcomes = {} as Record<ScenarioName, Outcome>;

  function runScenario(scenario: Scenario): Outcome {
    // Forward slashes everywhere (see `join`).
    const work = mkdtempSync(join(tmpdir(), 'pw-deps-')).split(sep).join('/');
    roots.push(work);
    const bin = join(work, 'bin');
    const cacheDir = join(work, 'cache');
    const archivesDir = join(work, 'archives');
    const scratchDir = join(work, 'tmp');
    const boundsFile = join(work, '99-ci-bounds');
    const callsFile = join(work, 'calls.log');
    for (const dir of [bin, archivesDir, scratchDir]) mkdirSync(dir);
    writeFileSync(callsFile, '');
    writeFileSync(join(archivesDir, 'already-on-the-image.deb'), '');
    if (scenario.cached !== undefined) {
      mkdirSync(cacheDir);
      for (const name of scenario.cached) writeFileSync(join(cacheDir, name), '');
    }
    const fakes: Record<string, string> = {
      sudo: 'exec "$@"',
      // `dpkg --configure -a` always works; `dpkg -i` fails when the scenario says so.
      dpkg: 'echo "dpkg $*" >> "$CALLS"; [ "$1" = "--configure" ] && exit 0; exit "${FAKE_DPKG_EXIT:-0}"',
      // install-deps "downloads" one package into the apt cache, as apt-get does, then exits as the scenario says.
      npx: [
        'echo "npx $*" >> "$CALLS"',
        'if [ "$2" = "install-deps" ]; then : > "$APT_ARCHIVES_DIR/downloaded.deb"; exit "${FAKE_INSTALL_DEPS_EXIT:-0}"; fi',
        'exit 0',
      ].join('\n'),
    };
    for (const [name, body] of Object.entries(fakes)) {
      const path = join(bin, name);
      writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
      chmodSync(path, 0o755);
    }
    const result = spawnSync('bash', [SCRIPT, cacheDir], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env['PATH'] ?? ''}`,
        TMPDIR: scratchDir,
        CALLS: callsFile,
        PLAYWRIGHT_DEBS_CACHE_HIT: scenario.cacheHit,
        PLAYWRIGHT_DEBS_CACHE_KEY: CACHE_KEY,
        APT_BOUNDS_FILE: boundsFile,
        APT_ARCHIVES_DIR: archivesDir,
        FAKE_DPKG_EXIT: String(scenario.dpkgExit ?? 0),
        FAKE_INSTALL_DEPS_EXIT: String(scenario.installDepsExit ?? 0),
      },
    });
    return {
      status: result.status,
      output: `${result.stdout}${result.stderr}`,
      calls: readFileSync(callsFile, 'utf8').split('\n').filter((line) => line !== ''),
      boundsFile: existsSync(boundsFile) ? readFileSync(boundsFile, 'utf8') : null,
      cachedAfter: existsSync(cacheDir) ? readdirSync(cacheDir).sort() : [],
      leftover: readdirSync(scratchDir),
    };
  }

  beforeAll(() => {
    for (const name of Object.keys(SCENARIOS) as ScenarioName[]) outcomes[name] = runScenario(SCENARIOS[name]);
  });

  afterAll(() => {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  });

  const npxCalls = (name: ScenarioName): string[] => outcomes[name].calls.filter((call) => call.startsWith('npx'));
  const dpkgInstalls = (name: ScenarioName): string[] => outcomes[name].calls.filter((call) => call.startsWith('dpkg -i'));

  it('a hit installs the cached packages with dpkg, with no apt, no download and no bound file', () => {
    const hit = outcomes.hit;
    expect(hit.status).toBe(0);
    expect(dpkgInstalls('hit')).toHaveLength(1);
    expect(hit.calls.join('\n')).toContain('libfoo.deb');
    expect(hit.calls.join('\n')).not.toContain('install-deps');
    expect(hit.boundsFile).toBeNull();
    expect(hit.calls.at(-1)).toBe('npx playwright install chromium');
    expect(hit.output).not.toContain('::warning');
  });

  it('a miss bounds apt (20 s timeout, 3 retries), installs the system packages, then the browser', () => {
    expect(outcomes.miss.status).toBe(0);
    expect(outcomes.miss.boundsFile).toContain('Acquire::http::Timeout "20";');
    expect(outcomes.miss.boundsFile).toContain('Acquire::Retries "3";');
    expect(dpkgInstalls('miss')).toEqual([]);
    expect(npxCalls('miss')).toEqual(['npx playwright install-deps chromium', 'npx playwright install chromium']);
  });

  it('a miss keeps the packages the install downloaded, and only those', () => {
    expect(outcomes.miss.cachedAfter).toEqual(['downloaded.deb']);
  });

  it('a hit whose dpkg install fails falls back to the bounded normal install and still ends green', () => {
    const bad = outcomes.badHit;
    expect(bad.status).toBe(0);
    expect(bad.output).toContain('::warning::The cached system packages could not be installed');
    expect(bad.boundsFile).not.toBeNull();
    expect(npxCalls('badHit')).toEqual(['npx playwright install-deps chromium', 'npx playwright install chromium']);
    expect(bad.cachedAfter).toEqual(['downloaded.deb']);
  });

  it('PRF-03 / QLT-81: the fallback warning names the cache key and the exact command that deletes it', () => {
    const warning = outcomes.badHit.output.split('\n').find((line) => line.startsWith('::warning::')) ?? '';
    expect(warning).toContain(`cache key ${CACHE_KEY}`);
    expect(warning).toContain(`gh cache delete ${CACHE_KEY}`);
    expect(warning).toContain('CACHE_EPOCH');
  });

  it('a hit with an empty cache directory also takes the normal install, not a failed dpkg call', () => {
    expect(outcomes.emptyHit.status).toBe(0);
    expect(dpkgInstalls('emptyHit')).toEqual([]);
    expect(outcomes.emptyHit.calls).toContain('npx playwright install-deps chromium');
  });

  it('QLT-79: when only the system-package install fails, the step fails and the browser install is not reached', () => {
    const failed = outcomes.failedInstall;
    expect(failed.status).not.toBe(0);
    expect(npxCalls('failedInstall')).toEqual(['npx playwright install-deps chromium']);
    expect(failed.cachedAfter).toEqual([]);
  });

  it('STD-04: no temporary file is left behind, after a good run or a failed install', () => {
    for (const name of Object.keys(SCENARIOS) as ScenarioName[]) expect(outcomes[name].leftover, name).toEqual([]);
  });
});
