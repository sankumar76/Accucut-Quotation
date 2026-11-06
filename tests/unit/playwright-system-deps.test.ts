import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { posix, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * DEF-015 (AQP-206) and AQP-216 (STORY-10.16), test strategy 10.6: scripts/ci/playwright-system-deps.sh installs the
 * browser's system packages from a cache without a network; on a miss it reads the package list from Playwright's dry
 * run, downloads the packages under `timeout` in up to three tries (tries 2 and 3 on archive.ubuntu.com), installs them
 * offline and keeps them; it warns and takes the bounded AQP-206 install when the dry run cannot be read. The script
 * runs here against fake `sudo`, `dpkg`, `apt-get` and `npx` programs that log their calls, so no package is installed
 * and nothing is downloaded. The real apt run is shown by the CI logs.
 *
 * Every scenario runs once, in `beforeAll`, under the shared hook limit (vitest.config.ts, DL-057), and the tests read
 * the recorded outcomes. Each scenario starts a bash and several fake programs, which is slow on a Windows checkout
 * (QLT-80), and that cost belongs in a hook, not in a test with the 5 s test limit. The two `timeout` limits are set to
 * 4 s here (the script's own settings), so a "stalled" fake program costs four seconds; the real defaults, 45 s and 90 s,
 * are pinned in tests/unit/ci-workflow.test.ts.
 */

const SCRIPT = fileURLToPath(new URL('../../scripts/ci/playwright-system-deps.sh', import.meta.url));
const BASH_AVAILABLE = spawnSync('bash', ['--version']).error === undefined;
// posix.join keeps forward slashes on Windows too: bash there reads a backslash in a glob as an escape.
const join = posix.join;

/** The script's two `timeout` limits here. A stalled fake costs this long; a healthy one finishes far inside it. */
const LIMIT_SECONDS = 4;

const CACHE_KEY = 'playwright-debs-e1-ubuntu99-20990101.1.1-9.9.9';
const FIRST_MIRROR = 'azure.archive.ubuntu.com';
const FALLBACK_MIRROR = 'archive.ubuntu.com';
/** A repository that is not Ubuntu's: the mirror switch must leave it alone. */
const OTHER_SOURCE = 'deb https://packages.example.test/ubuntu/24.04/prod noble main';

const DRY_RUN_COMMAND = 'apt-get update && apt-get install -y --no-install-recommends libfoo1 libbar-dev\n';
const DRY_RUN_REPORT = 'Missing system dependencies (2):\n  libfoo1\n  libbar-dev\n';

/** What a fake `apt-get update` or download does on its nth call. `hang` runs past the script's time limit. */
type Step = 'ok' | 'fail' | 'hang';

interface Scenario {
  readonly cacheHit: 'true' | 'false';
  /** Files already in the cache directory when the script starts. */
  readonly cached?: ReadonlyArray<string>;
  /** Exit status of `dpkg -i`. */
  readonly dpkgExit?: number;
  /** What `npx playwright install-deps --dry-run chromium` prints. */
  readonly dryRun?: string;
  /** Exit status of `npx playwright install-deps chromium` (the bounded AQP-206 path) only. */
  readonly installDepsExit?: number;
  readonly updates?: ReadonlyArray<Step>;
  readonly downloads?: ReadonlyArray<Step>;
  /** Exit status of `apt-get install --no-download`. */
  readonly offlineExit?: number;
}

interface Outcome {
  readonly status: number | null;
  readonly output: string;
  readonly calls: ReadonlyArray<string>;
  readonly boundsFile: string | null;
  readonly cachedAfter: ReadonlyArray<string>;
  /** The Ubuntu and the other source file after the run. */
  readonly ubuntuSources: string;
  readonly otherSources: string;
  /** Files the script left in its temporary directory. */
  readonly leftover: ReadonlyArray<string>;
}

const SCENARIOS = {
  hit: { cacheHit: 'true', cached: ['libfoo.deb'] },
  miss: { cacheHit: 'false' },
  missReport: { cacheHit: 'false', dryRun: DRY_RUN_REPORT },
  badHit: { cacheHit: 'true', cached: ['corrupt.deb'], dpkgExit: 1 },
  emptyHit: { cacheHit: 'true', cached: [] },
  nothingMissing: { cacheHit: 'false', dryRun: 'All system dependencies are installed.\n' },
  // AQP-216 AC-3 / AC-6: the dry run holds no install command, so the script warns and takes the AQP-206 path.
  noInstallCommand: { cacheHit: 'false', dryRun: 'Something else entirely.\n' },
  // Only the system-package install fails, so the browser install after it would succeed: only `set -e` can stop the step.
  noInstallCommandAndInstallFails: { cacheHit: 'false', dryRun: 'Something else entirely.\n', installDepsExit: 1 },
  // AQP-216 AC-4: the first mirror fails or stalls, the next try succeeds on archive.ubuntu.com.
  updateFailsOnce: { cacheHit: 'false', updates: ['fail', 'ok'] },
  updateStallsOnce: { cacheHit: 'false', updates: ['hang', 'ok'] },
  downloadStallsOnce: { cacheHit: 'false', downloads: ['hang', 'ok'] },
  // AQP-216 AC-5: every try fails.
  everyUpdateFails: { cacheHit: 'false', updates: ['fail', 'fail', 'fail'] },
  everyDownloadFails: { cacheHit: 'false', downloads: ['hang', 'fail', 'hang'] },
  offlineInstallFails: { cacheHit: 'false', offlineExit: 1 },
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
    const aptDir = join(work, 'etc-apt');
    const boundsFile = join(work, '99-ci-bounds');
    const callsFile = join(work, 'calls.log');
    const ubuntuSourcesFile = join(aptDir, 'sources.list.d', 'ubuntu.sources');
    const otherSourcesFile = join(aptDir, 'sources.list.d', 'other.list');
    for (const dir of [bin, archivesDir, scratchDir, aptDir, join(aptDir, 'sources.list.d')]) mkdirSync(dir);
    writeFileSync(callsFile, '');
    writeFileSync(join(archivesDir, 'already-on-the-image.deb'), '');
    writeFileSync(ubuntuSourcesFile, `Types: deb\nURIs: http://${FIRST_MIRROR}/ubuntu/\nSuites: noble noble-updates\n`);
    writeFileSync(otherSourcesFile, `${OTHER_SOURCE}\n`);
    if (scenario.cached !== undefined) {
      mkdirSync(cacheDir);
      for (const name of scenario.cached) writeFileSync(join(cacheDir, name), '');
    }
    // `sequence <counter> <steps>` sets `step` to the nth step of a list, `ok` once the list is used up. Shell built-ins
    // only: a forked program costs well over a second on a busy Windows machine, and a healthy fake must finish well
    // inside the script's time limit (LIMIT_SECONDS).
    const sequence = [
      'sequence() {',
      '  local n=0; [ -f "$CALLS.$1" ] && read -r n < "$CALLS.$1"',
      '  n=$((n + 1)); echo "$n" > "$CALLS.$1"',
      '  local -a steps=($2); step="${steps[$((n - 1))]:-ok}"',
      '}',
    ].join('\n');
    const runStep = 'case "$step" in fail) exit 100;; hang) exec sleep 30;; esac';
    const fakes: Record<string, string> = {
      sudo: 'exec "$@"',
      // `dpkg --configure -a` always works; `dpkg -i` fails when the scenario says so.
      dpkg: 'echo "dpkg $*" >> "$CALLS"; [ "$1" = "--configure" ] && exit 0; exit "${FAKE_DPKG_EXIT:-0}"',
      // The dry run exits 1 when packages are missing, as Playwright does. install-deps (the AQP-206 path) "downloads"
      // one package into the apt cache, as apt-get does, then exits as the scenario says.
      npx: [
        'echo "npx $*" >> "$CALLS"',
        'if [ "$2" = "install-deps" ] && [ "$3" = "--dry-run" ]; then printf \'%b\' "$FAKE_DRY_RUN"; exit 1; fi',
        'if [ "$2" = "install-deps" ]; then : > "$APT_ARCHIVES_DIR/downloaded.deb"; exit "${FAKE_INSTALL_DEPS_EXIT:-0}"; fi',
        'exit 0',
      ].join('\n'),
      // The mirror in use is logged with each update, so a test can see where tries 2 and 3 went.
      'apt-get': [
        sequence,
        'mirror=""',
        'while read -r key value; do',
        '  if [ "$key" = "URIs:" ]; then mirror="${value#*://}"; mirror="${mirror%%/*}"; break; fi',
        'done < "$APT_SOURCES_DIR/sources.list.d/ubuntu.sources"',
        'case "$1" in',
        '  update)',
        '    echo "apt-get update @ $mirror" >> "$CALLS"',
        '    sequence update "$FAKE_UPDATES"; ' + runStep + '; exit 0;;',
        '  install)',
        '    echo "apt-get $*" >> "$CALLS"',
        '    case " $* " in',
        '      *" --download-only "*)',
        '        sequence download "$FAKE_DOWNLOADS"; ' + runStep,
        '        for arg in "$@"; do case "$arg" in -*|install) ;; *) : > "$APT_ARCHIVES_DIR/${arg}_1.0_amd64.deb";; esac; done; exit 0;;',
        '      *" --no-download "*) exit "${FAKE_OFFLINE_EXIT:-0}";;',
        '    esac;;',
        'esac',
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
        APT_SOURCES_DIR: aptDir,
        APT_UPDATE_TIMEOUT: String(LIMIT_SECONDS),
        APT_DOWNLOAD_TIMEOUT: String(LIMIT_SECONDS),
        FAKE_DPKG_EXIT: String(scenario.dpkgExit ?? 0),
        FAKE_DRY_RUN: scenario.dryRun ?? DRY_RUN_COMMAND,
        FAKE_INSTALL_DEPS_EXIT: String(scenario.installDepsExit ?? 0),
        FAKE_UPDATES: (scenario.updates ?? []).join(' '),
        FAKE_DOWNLOADS: (scenario.downloads ?? []).join(' '),
        FAKE_OFFLINE_EXIT: String(scenario.offlineExit ?? 0),
      },
    });
    return {
      status: result.status,
      output: `${result.stdout}${result.stderr}`,
      calls: readFileSync(callsFile, 'utf8').split('\n').filter((line) => line !== ''),
      boundsFile: existsSync(boundsFile) ? readFileSync(boundsFile, 'utf8') : null,
      cachedAfter: existsSync(cacheDir) ? readdirSync(cacheDir).sort() : [],
      ubuntuSources: readFileSync(ubuntuSourcesFile, 'utf8'),
      otherSources: readFileSync(otherSourcesFile, 'utf8'),
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
  const aptCalls = (name: ScenarioName): string[] => outcomes[name].calls.filter((call) => call.startsWith('apt-get'));
  const DRY_RUN = 'npx playwright install-deps --dry-run chromium';
  const BROWSER = 'npx playwright install chromium';
  const UPDATE = `apt-get update @ ${FIRST_MIRROR}`;
  const UPDATE_ON_FALLBACK = `apt-get update @ ${FALLBACK_MIRROR}`;
  const DOWNLOAD = 'apt-get install --download-only -y --no-install-recommends libfoo1 libbar-dev';
  const OFFLINE = 'apt-get install -y --no-download --no-install-recommends libfoo1 libbar-dev';

  it('a hit installs the cached packages with dpkg, with no apt, no download and no bound file', () => {
    const hit = outcomes.hit;
    expect(hit.status).toBe(0);
    expect(dpkgInstalls('hit')).toHaveLength(1);
    expect(hit.calls.join('\n')).toContain('libfoo.deb');
    expect(hit.calls.join('\n')).not.toContain('install-deps');
    expect(aptCalls('hit')).toEqual([]);
    expect(hit.boundsFile).toBeNull();
    expect(hit.calls.at(-1)).toBe(BROWSER);
    expect(hit.output).not.toContain('::warning');
  });

  it('AC-3: a miss reads the list from the dry run, downloads under the bounds, installs offline, then installs the browser', () => {
    expect(outcomes.miss.status).toBe(0);
    expect(outcomes.miss.boundsFile).toContain('Acquire::http::Timeout "20";');
    expect(outcomes.miss.boundsFile).toContain('Acquire::Retries "3";');
    expect(dpkgInstalls('miss')).toEqual([]);
    expect(npxCalls('miss')).toEqual([DRY_RUN, BROWSER]);
    expect(aptCalls('miss')).toEqual([UPDATE, DOWNLOAD, OFFLINE]);
    expect(outcomes.miss.output).toContain('Missing system packages (2): libfoo1 libbar-dev');
    expect(outcomes.miss.output).not.toContain('::warning');
    expect(outcomes.miss.output).not.toContain('::error');
  });

  it('AC-3: a healthy miss never switches the mirror', () => {
    expect(outcomes.miss.ubuntuSources).toContain(`http://${FIRST_MIRROR}/ubuntu/`);
    expect(outcomes.miss.ubuntuSources).not.toContain(`//${FALLBACK_MIRROR}/`);
  });

  it('AC-3: a miss keeps the packages the download fetched, and only those', () => {
    expect(outcomes.miss.cachedAfter).toEqual(['libbar-dev_1.0_amd64.deb', 'libfoo1_1.0_amd64.deb']);
  });

  it('AC-3: the report that Playwright 1.64.1 prints (no install command) gives the same list and the same install', () => {
    expect(outcomes.missReport.status).toBe(0);
    expect(aptCalls('missReport')).toEqual([UPDATE, DOWNLOAD, OFFLINE]);
    expect(outcomes.missReport.output).not.toContain('::warning');
    expect(outcomes.missReport.cachedAfter).toEqual(['libbar-dev_1.0_amd64.deb', 'libfoo1_1.0_amd64.deb']);
  });

  it('when Playwright reports nothing missing, there is nothing to download and the browser is still installed', () => {
    const none = outcomes.nothingMissing;
    expect(none.status).toBe(0);
    expect(aptCalls('nothingMissing')).toEqual([]);
    expect(npxCalls('nothingMissing')).toEqual([DRY_RUN, BROWSER]);
    expect(none.output).toContain('nothing to download');
    expect(none.cachedAfter).toEqual([]);
  });

  it('AC-3 / AC-6: a dry run with no install command warns and takes the bounded AQP-206 install; it does not fail', () => {
    const fallback = outcomes.noInstallCommand;
    expect(fallback.status).toBe(0);
    expect(fallback.output).toContain('::warning::The output of');
    expect(aptCalls('noInstallCommand')).toEqual([]);
    expect(fallback.boundsFile).toContain('Acquire::http::Timeout "20";');
    expect(npxCalls('noInstallCommand')).toEqual([DRY_RUN, 'npx playwright install-deps chromium', BROWSER]);
    expect(fallback.cachedAfter).toEqual(['downloaded.deb']);
  });

  it('QLT-79: when the bounded install fails, the step fails and the browser install is not reached', () => {
    const failed = outcomes.noInstallCommandAndInstallFails;
    expect(failed.status).not.toBe(0);
    expect(npxCalls('noInstallCommandAndInstallFails')).toEqual([DRY_RUN, 'npx playwright install-deps chromium']);
    expect(failed.cachedAfter).toEqual([]);
  });

  it('a hit whose dpkg install fails falls back to the download path and still ends green', () => {
    const bad = outcomes.badHit;
    expect(bad.status).toBe(0);
    expect(bad.output).toContain('::warning::The cached system packages could not be installed');
    expect(bad.boundsFile).not.toBeNull();
    expect(npxCalls('badHit')).toEqual([DRY_RUN, BROWSER]);
    expect(aptCalls('badHit')).toEqual([UPDATE, DOWNLOAD, OFFLINE]);
    expect(bad.cachedAfter).toEqual(['libbar-dev_1.0_amd64.deb', 'libfoo1_1.0_amd64.deb']);
  });

  it('PRF-03 / QLT-81: the fallback warning names the cache key and the exact command that deletes it', () => {
    const warning = outcomes.badHit.output.split('\n').find((line) => line.startsWith('::warning::')) ?? '';
    expect(warning).toContain(`cache key ${CACHE_KEY}`);
    expect(warning).toContain(`gh cache delete ${CACHE_KEY}`);
    expect(warning).toContain('CACHE_EPOCH');
  });

  it('a hit with an empty cache directory also takes the download path, not a failed dpkg call', () => {
    expect(outcomes.emptyHit.status).toBe(0);
    expect(dpkgInstalls('emptyHit')).toEqual([]);
    expect(outcomes.emptyHit.calls).toContain(DOWNLOAD);
  });

  it('AC-4: a failed apt-get update ends the try at once: no download from that mirror, and try 2 uses archive.ubuntu.com', () => {
    const run = outcomes.updateFailsOnce;
    expect(run.status).toBe(0);
    expect(aptCalls('updateFailsOnce')).toEqual([UPDATE, UPDATE_ON_FALLBACK, DOWNLOAD, OFFLINE]);
    expect(run.output).toContain('apt-get update failed with status 100');
    expect(run.output).toContain(`Try 2 of 3, mirror ${FALLBACK_MIRROR}.`);
    expect(run.cachedAfter).toEqual(['libbar-dev_1.0_amd64.deb', 'libfoo1_1.0_amd64.deb']);
    expect(npxCalls('updateFailsOnce').at(-1)).toBe(BROWSER);
  });

  it('AC-4: an apt-get update that reaches its time limit also ends the try without a download', () => {
    const run = outcomes.updateStallsOnce;
    expect(run.status).toBe(0);
    expect(aptCalls('updateStallsOnce')).toEqual([UPDATE, UPDATE_ON_FALLBACK, DOWNLOAD, OFFLINE]);
    expect(run.output).toContain(`apt-get update reached its ${LIMIT_SECONDS} s limit`);
  });

  it('AC-4: a download that reaches its time limit is stopped and the next try runs on archive.ubuntu.com', () => {
    const run = outcomes.downloadStallsOnce;
    expect(run.status).toBe(0);
    expect(aptCalls('downloadStallsOnce')).toEqual([UPDATE, DOWNLOAD, UPDATE_ON_FALLBACK, DOWNLOAD, OFFLINE]);
    expect(run.output).toContain(`The download reached its ${LIMIT_SECONDS} s limit`);
  });

  it('AC-4: switching the mirror changes the Ubuntu sources only, and leaves another repository alone', () => {
    expect(outcomes.updateFailsOnce.ubuntuSources).toContain(`URIs: http://${FALLBACK_MIRROR}/ubuntu/`);
    expect(outcomes.updateFailsOnce.ubuntuSources).not.toContain(FIRST_MIRROR);
    expect(outcomes.updateFailsOnce.ubuntuSources).toContain('Suites: noble noble-updates');
    for (const name of Object.keys(SCENARIOS) as ScenarioName[]) expect(outcomes[name].otherSources.trim(), name).toBe(OTHER_SOURCE);
  });

  it('AC-5: when every update fails there are three tries, no download at all, and a message that names the mirrors', () => {
    const run = outcomes.everyUpdateFails;
    expect(run.status).not.toBe(0);
    expect(aptCalls('everyUpdateFails')).toEqual([UPDATE, UPDATE_ON_FALLBACK, UPDATE_ON_FALLBACK]);
    expect(run.output).toContain(`::error::The system packages could not be downloaded in 3 tries (mirrors tried: ${FIRST_MIRROR}, ${FALLBACK_MIRROR}, ${FALLBACK_MIRROR}).`);
    expect(run.output).toContain('Nothing was installed.');
  });

  it('AC-5: when every download fails or stalls there are three tries, nothing is installed, and nothing is cached or run after', () => {
    const run = outcomes.everyDownloadFails;
    expect(run.status).not.toBe(0);
    expect(aptCalls('everyDownloadFails')).toEqual([UPDATE, DOWNLOAD, UPDATE_ON_FALLBACK, DOWNLOAD, UPDATE_ON_FALLBACK, DOWNLOAD]);
    expect(run.calls).not.toContain(OFFLINE);
    expect(run.output).toContain(`mirrors tried: ${FIRST_MIRROR}, ${FALLBACK_MIRROR}, ${FALLBACK_MIRROR}`);
    expect(npxCalls('everyDownloadFails')).toEqual([DRY_RUN]);
    expect(run.cachedAfter).toEqual([]);
  });

  it('a failed offline install fails the step (nothing is cached, the browser install is not reached)', () => {
    const run = outcomes.offlineInstallFails;
    expect(run.status).not.toBe(0);
    expect(aptCalls('offlineInstallFails')).toEqual([UPDATE, DOWNLOAD, OFFLINE]);
    expect(npxCalls('offlineInstallFails')).toEqual([DRY_RUN]);
    expect(run.cachedAfter).toEqual([]);
  });

  it('STD-04: no temporary file is left behind, after a good run or a failed install', () => {
    for (const name of Object.keys(SCENARIOS) as ScenarioName[]) expect(outcomes[name].leftover, name).toEqual([]);
  });
});
