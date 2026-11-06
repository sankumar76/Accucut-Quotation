import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { posix, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * DEF-015 (AQP-206) and AQP-216 (STORY-10.16), test strategy 10.6: scripts/ci/playwright-system-deps.sh installs the
 * browser's system packages from a cache without a network; on a miss it reads the package list from Playwright's dry
 * run, downloads the packages under `timeout` in up to three tries, installs them offline and keeps them; it warns and
 * takes the bounded AQP-206 install when the dry run cannot be read. Each try has its own apt view (QLT-95): a temporary
 * copy of the image's ubuntu.sources that names only that try's mirror, and a package-list directory of its own, passed
 * to all three apt commands. The script runs here against fake `sudo`, `dpkg`, `apt-get` and `npx` programs that log
 * their calls, so no package is installed and nothing is downloaded. The real apt run is shown by the CI logs.
 *
 * Every scenario runs once, in `beforeAll`, under the shared hook limit (vitest.config.ts, DL-057), and the tests read
 * the recorded outcomes. Each scenario starts a bash and several fake programs, which is slow on a Windows checkout
 * (QLT-80), and that cost belongs in a hook, not in a test with the 5 s test limit. The two `timeout` limits are set to
 * 4 s here (the script's own settings), so a "stalled" fake program costs four seconds; the real defaults, 45 s and 90 s,
 * are read from the script by tests/unit/ci-workflow.test.ts.
 */

const SCRIPT = fileURLToPath(new URL('../../scripts/ci/playwright-system-deps.sh', import.meta.url));
const BASH_AVAILABLE = spawnSync('bash', ['--version']).error === undefined;
// posix.join keeps forward slashes on Windows too: bash there reads a backslash in a glob as an escape.
const join = posix.join;

/** The script's two `timeout` limits here. A stalled fake costs this long; a healthy one finishes far inside it. */
const LIMIT_SECONDS = 4;

const CACHE_KEY = 'playwright-debs-e1-ubuntu99-20990101.1.1-9.9.9';
/** What the runner image writes for its own mirror (a list of mirrors in a file), in two stanzas. */
const FIRST_URIS = 'mirror+file:/etc/apt/apt-mirrors.txt';
const FALLBACK_MIRROR = 'archive.ubuntu.com';
const FALLBACK_URIS = `http://${FALLBACK_MIRROR}/ubuntu/`;
const SIGNED_BY = 'Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg';
const IMAGE_SOURCES = [
  'Types: deb',
  `URIs: ${FIRST_URIS}`,
  'Suites: noble noble-updates',
  'Components: main universe',
  SIGNED_BY,
  '',
  'Types: deb',
  `URIs: ${FIRST_URIS}`,
  'Suites: noble-security',
  'Components: main universe',
  SIGNED_BY,
  '',
].join('\n');
/** A repository that is not Ubuntu's: no apt view may hold it, and the runner's own file must stay as it was. */
const OTHER_SOURCE = 'deb https://packages.example.test/ubuntu/24.04/prod noble main';

const DRY_RUN_COMMAND = 'apt-get update && apt-get install -y --no-install-recommends libfoo1 libbar-dev\n';
const DRY_RUN_REPORT = 'Missing system dependencies (2):\n  libfoo1\n  libbar-dev\n';

/** What a fake `apt-get update` or download does on its nth call. `hang` runs past the script's time limit; `warn` prints a `W:` line and succeeds. */
type Step = 'ok' | 'fail' | 'hang' | 'warn';

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
  /** The image has no ubuntu.sources. */
  readonly noImageSources?: boolean;
}

/** One apt view as the fake `apt-get update` saw it: the files in the view's source directory and the text of ubuntu.sources. */
interface SeenView {
  readonly files: string;
  readonly content: string;
}

interface Outcome {
  readonly status: number | null;
  readonly output: string;
  readonly calls: ReadonlyArray<string>;
  readonly boundsFile: string | null;
  readonly cachedAfter: ReadonlyArray<string>;
  readonly views: ReadonlyArray<SeenView>;
  /** The runner's own source directory after the run: file names with their text. */
  readonly runnerSourcesAfter: ReadonlyMap<string, string>;
  /** Files the script left in its temporary directory. */
  readonly leftover: ReadonlyArray<string>;
  /** The directories the script removed with `sudo rm` (an empty path is not listed). */
  readonly sudoRemovals: ReadonlyArray<string>;
}

const SCENARIO_LIST = [
  ['hit', { cacheHit: 'true', cached: ['libfoo.deb'] }],
  ['miss', { cacheHit: 'false' }],
  ['missReport', { cacheHit: 'false', dryRun: DRY_RUN_REPORT }],
  ['badHit', { cacheHit: 'true', cached: ['corrupt.deb'], dpkgExit: 1 }],
  ['emptyHit', { cacheHit: 'true', cached: [] }],
  ['nothingMissing', { cacheHit: 'false', dryRun: 'All system dependencies are installed.\n' }],
  // AQP-216 AC-3 / AC-6: the dry run holds no install command, so the script warns and takes the AQP-206 path.
  ['noInstallCommand', { cacheHit: 'false', dryRun: 'Something else entirely.\n' }],
  // Only the system-package install fails, so the browser install after it would succeed: only `set -e` can stop the step.
  ['noInstallCommandAndInstallFails', { cacheHit: 'false', dryRun: 'Something else entirely.\n', installDepsExit: 1 }],
  // The image has no ubuntu.sources to build the views from: warn and take the AQP-206 path, as for an unreadable dry run.
  ['noImageSources', { cacheHit: 'false', noImageSources: true }],
  // QLT-95 (1): `apt-get update` prints a W: warning and exits 0; that does not end the try.
  ['updateWarnsOnly', { cacheHit: 'false', updates: ['warn'] }],
  // AQP-216 AC-4: the first mirror fails or stalls, the next try succeeds on archive.ubuntu.com.
  ['updateFailsOnce', { cacheHit: 'false', updates: ['fail', 'ok'] }],
  ['updateStallsOnce', { cacheHit: 'false', updates: ['hang', 'ok'] }],
  ['downloadStallsOnce', { cacheHit: 'false', downloads: ['hang', 'ok'] }],
  // AQP-216 AC-5: every try fails.
  ['everyUpdateFails', { cacheHit: 'false', updates: ['fail', 'fail', 'fail'] }],
  ['everyDownloadFails', { cacheHit: 'false', downloads: ['hang', 'fail', 'hang'] }],
  ['offlineInstallFails', { cacheHit: 'false', offlineExit: 1 }],
] as const satisfies ReadonlyArray<readonly [string, Scenario]>;

type ScenarioName = (typeof SCENARIO_LIST)[number][0];

const SCENARIOS = new Map<ScenarioName, Scenario>(SCENARIO_LIST);

/** The three options every apt command of a try carries, with one directory for the view (STD-01: a regex, not a cast). */
const VIEW_OPTIONS = /-o Dir::Etc::SourceList=\/dev\/null -o Dir::Etc::SourceParts=(\S+)\/sources\.list\.d -o Dir::State::Lists=\1\/lists/;

describe.skipIf(!BASH_AVAILABLE)('scripts/ci/playwright-system-deps.sh', () => {
  const roots: string[] = [];
  const outcomes = new Map<ScenarioName, Outcome>();

  function runScenario(scenario: Scenario): Outcome {
    // Forward slashes everywhere (see `join`).
    const work = mkdtempSync(join(tmpdir(), 'pw-deps-')).split(sep).join('/');
    roots.push(work);
    const bin = join(work, 'bin');
    const cacheDir = join(work, 'cache');
    const archivesDir = join(work, 'archives');
    const scratchDir = join(work, 'tmp');
    const aptDir = join(work, 'etc-apt');
    const sourcesDir = join(aptDir, 'sources.list.d');
    const boundsFile = join(work, '99-ci-bounds');
    const callsFile = join(work, 'calls.log');
    for (const dir of [bin, archivesDir, scratchDir, aptDir, sourcesDir]) mkdirSync(dir);
    writeFileSync(callsFile, '');
    writeFileSync(`${callsFile}.views`, '');
    writeFileSync(`${callsFile}.sudo`, '');
    writeFileSync(join(archivesDir, 'already-on-the-image.deb'), '');
    if (scenario.noImageSources !== true) writeFileSync(join(sourcesDir, 'ubuntu.sources'), IMAGE_SOURCES);
    writeFileSync(join(sourcesDir, 'other.list'), `${OTHER_SOURCE}\n`);
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
    const runStep = 'case "$step" in fail) exit 100;; hang) exec sleep 30;; warn) echo "W: Failed to fetch http://mirror.example.test/InRelease  Temporary failure" >&2;; esac';
    const fakes: Record<string, string> = {
      // `sudo rm` is logged to its own file: apt, run as root, leaves root-owned files in a view, so only `sudo rm` can remove it.
      sudo: '[ "$1" = "rm" ] && echo "$*" >> "$CALLS.sudo"; exec "$@"',
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
      // Every call is logged with its arguments and with the URIs of the view it was given, so a test can see where each
      // try went and which options it carried. An update also records the view's source directory and ubuntu.sources.
      'apt-get': [
        sequence,
        'dir=""',
        'for arg in "$@"; do case "$arg" in Dir::Etc::SourceParts=*) dir="${arg#*=}";; esac; done',
        'uris="(no view)"',
        'if [ -f "$dir/ubuntu.sources" ]; then',
        '  uris=""',
        '  while read -r key value _; do [ "$key" = "URIs:" ] && uris="${uris:+$uris }$value"; done < "$dir/ubuntu.sources"',
        'fi',
        'case "$1" in',
        '  update)',
        '    echo "apt-get $* @ $uris" >> "$CALLS"',
        '    files=""; for f in "$dir"/*; do files="${files:+$files }${f##*/}"; done',
        '    { echo "== update $files"; while IFS= read -r line || [ -n "$line" ]; do echo "$line"; done < "$dir/ubuntu.sources"; } >> "$CALLS.views"',
        '    sequence update "$FAKE_UPDATES"; ' + runStep + '; exit 0;;',
        '  install)',
        '    echo "apt-get $* @ $uris" >> "$CALLS"',
        '    case " $* " in',
        '      *" --download-only "*)',
        '        sequence download "$FAKE_DOWNLOADS"; ' + runStep,
        '        args=("$@"); i=0',
        '        while [ "$i" -lt "${#args[@]}" ]; do',
        '          a="${args[$i]}"',
        '          case "$a" in -o) i=$((i + 2)); continue;; -*|install) ;; *) : > "$APT_ARCHIVES_DIR/${a}_1.0_amd64.deb";; esac',
        '          i=$((i + 1))',
        '        done',
        '        exit 0;;',
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
    const views = readFileSync(`${callsFile}.views`, 'utf8')
      .split(/^== update /m)
      .slice(1)
      .map((block): SeenView => {
        const end = block.indexOf('\n');
        return { files: block.slice(0, end), content: block.slice(end + 1) };
      });
    const runnerSourcesAfter = new Map<string, string>();
    for (const name of readdirSync(sourcesDir).sort()) runnerSourcesAfter.set(name, readFileSync(join(sourcesDir, name), 'utf8'));
    return {
      status: result.status,
      output: `${result.stdout}${result.stderr}`,
      calls: readFileSync(callsFile, 'utf8').split('\n').filter((line) => line !== ''),
      boundsFile: existsSync(boundsFile) ? readFileSync(boundsFile, 'utf8') : null,
      cachedAfter: existsSync(cacheDir) ? readdirSync(cacheDir).sort() : [],
      views,
      runnerSourcesAfter,
      leftover: readdirSync(scratchDir),
      sudoRemovals: readFileSync(`${callsFile}.sudo`, 'utf8')
        .split('\n')
        .filter((line) => line.startsWith('rm -rf -- /')),
    };
  }

  beforeAll(() => {
    for (const [name, scenario] of SCENARIOS) outcomes.set(name, runScenario(scenario));
  });

  afterAll(() => {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  });

  function outcome(name: ScenarioName): Outcome {
    const found = outcomes.get(name);
    if (found === undefined) throw new Error(`The scenario "${name}" did not run`);
    return found;
  }

  const npxCalls = (name: ScenarioName): string[] => outcome(name).calls.filter((call) => call.startsWith('npx'));
  const dpkgInstalls = (name: ScenarioName): string[] => outcome(name).calls.filter((call) => call.startsWith('dpkg -i'));
  /** The apt calls as the script made them, with the view's three options replaced by `<view>`. */
  const rawAptCalls = (name: ScenarioName): string[] => outcome(name).calls.filter((call) => call.startsWith('apt-get'));
  const aptCalls = (name: ScenarioName): string[] => rawAptCalls(name).map((call) => call.replace(VIEW_OPTIONS, '<view>'));
  const DRY_RUN = 'npx playwright install-deps --dry-run chromium';
  const BROWSER = 'npx playwright install chromium';
  /** Each stanza of the image's file names the mirror once, so a view names it twice. */
  const ON_IMAGE = `${FIRST_URIS} ${FIRST_URIS}`;
  const ON_FALLBACK = `${FALLBACK_URIS} ${FALLBACK_URIS}`;
  const update = (uris: string): string => `apt-get update <view> --error-on=any @ ${uris}`;
  const download = (uris: string): string => `apt-get install --download-only -y --no-install-recommends <view> libfoo1 libbar-dev @ ${uris}`;
  const offline = (uris: string): string => `apt-get install -y --no-download --no-install-recommends <view> libfoo1 libbar-dev @ ${uris}`;
  const MISS_ON_IMAGE = [update(ON_IMAGE), download(ON_IMAGE), offline(ON_IMAGE)];
  const MISS_ON_FALLBACK = [update(ON_IMAGE), update(ON_FALLBACK), download(ON_FALLBACK), offline(ON_FALLBACK)];
  const KEPT = ['libbar-dev_1.0_amd64.deb', 'libfoo1_1.0_amd64.deb'];

  it('a hit installs the cached packages with dpkg, with no apt, no download and no bound file', () => {
    const hit = outcome('hit');
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
    const miss = outcome('miss');
    expect(miss.status).toBe(0);
    expect(miss.boundsFile).toContain('Acquire::http::Timeout "20";');
    expect(miss.boundsFile).toContain('Acquire::Retries "3";');
    expect(dpkgInstalls('miss')).toEqual([]);
    expect(npxCalls('miss')).toEqual([DRY_RUN, BROWSER]);
    expect(aptCalls('miss')).toEqual(MISS_ON_IMAGE);
    expect(miss.output).toContain('Missing system packages (2): libfoo1 libbar-dev');
    expect(miss.output).not.toContain('::warning');
    expect(miss.output).not.toContain('::error');
  });

  it('AC-3: a healthy miss stays on the runner\'s own mirror: its view is the image\'s file, unchanged', () => {
    const miss = outcome('miss');
    expect(miss.views).toHaveLength(1);
    expect(miss.views[0]?.content).toBe(IMAGE_SOURCES);
    expect(miss.output).not.toContain(FALLBACK_MIRROR);
  });

  it('AC-3: a miss keeps the packages the download fetched, and only those', () => {
    expect(outcome('miss').cachedAfter).toEqual(KEPT);
  });

  it('AC-3: the report that Playwright 1.64.1 prints (no install command) gives the same list and the same install', () => {
    expect(outcome('missReport').status).toBe(0);
    expect(aptCalls('missReport')).toEqual(MISS_ON_IMAGE);
    expect(outcome('missReport').output).not.toContain('::warning');
    expect(outcome('missReport').cachedAfter).toEqual(KEPT);
  });

  it('when Playwright reports nothing missing, there is nothing to download and the browser is still installed', () => {
    const none = outcome('nothingMissing');
    expect(none.status).toBe(0);
    expect(aptCalls('nothingMissing')).toEqual([]);
    expect(npxCalls('nothingMissing')).toEqual([DRY_RUN, BROWSER]);
    expect(none.output).toContain('nothing to download');
    expect(none.cachedAfter).toEqual([]);
  });

  it('AC-3 / AC-6: a dry run with no install command warns and takes the bounded AQP-206 install; it does not fail', () => {
    const fallback = outcome('noInstallCommand');
    expect(fallback.status).toBe(0);
    expect(fallback.output).toContain('::warning::The output of');
    expect(aptCalls('noInstallCommand')).toEqual([]);
    expect(fallback.boundsFile).toContain('Acquire::http::Timeout "20";');
    expect(npxCalls('noInstallCommand')).toEqual([DRY_RUN, 'npx playwright install-deps chromium', BROWSER]);
    expect(fallback.cachedAfter).toEqual(['downloaded.deb']);
  });

  it('QLT-79: when the bounded install fails, the step fails and the browser install is not reached', () => {
    const failed = outcome('noInstallCommandAndInstallFails');
    expect(failed.status).not.toBe(0);
    expect(npxCalls('noInstallCommandAndInstallFails')).toEqual([DRY_RUN, 'npx playwright install-deps chromium']);
    expect(failed.cachedAfter).toEqual([]);
  });

  it('QLT-95: an image without ubuntu.sources cannot give a mirror view, so the script warns and takes the bounded install', () => {
    const none = outcome('noImageSources');
    expect(none.status).toBe(0);
    expect(none.output).toContain('::warning::');
    expect(none.output).toContain('ubuntu.sources does not exist on this image');
    expect(aptCalls('noImageSources')).toEqual([]);
    expect(npxCalls('noImageSources')).toEqual([DRY_RUN, 'npx playwright install-deps chromium', BROWSER]);
  });

  it('a hit whose dpkg install fails falls back to the download path and still ends green', () => {
    const bad = outcome('badHit');
    expect(bad.status).toBe(0);
    expect(bad.output).toContain('::warning::The cached system packages could not be installed');
    expect(bad.boundsFile).not.toBeNull();
    expect(npxCalls('badHit')).toEqual([DRY_RUN, BROWSER]);
    expect(aptCalls('badHit')).toEqual(MISS_ON_IMAGE);
    expect(bad.cachedAfter).toEqual(KEPT);
  });

  it('PRF-03 / QLT-81: the fallback warning names the cache key and the exact command that deletes it', () => {
    const warning = outcome('badHit').output.split('\n').find((line) => line.startsWith('::warning::')) ?? '';
    expect(warning).toContain(`cache key ${CACHE_KEY}`);
    expect(warning).toContain(`gh cache delete ${CACHE_KEY}`);
    expect(warning).toContain('CACHE_EPOCH');
  });

  it('a hit with an empty cache directory also takes the download path, not a failed dpkg call', () => {
    expect(outcome('emptyHit').status).toBe(0);
    expect(dpkgInstalls('emptyHit')).toEqual([]);
    expect(aptCalls('emptyHit')).toContain(download(ON_IMAGE));
  });

  it('QLT-95 (1): an update that prints a W: warning and exits 0 does not end the try: the download runs on the same mirror', () => {
    const run = outcome('updateWarnsOnly');
    expect(run.status).toBe(0);
    expect(run.output).toContain('W: Failed to fetch');
    expect(run.output).not.toContain('ending this try');
    expect(aptCalls('updateWarnsOnly')).toEqual(MISS_ON_IMAGE);
  });

  it('AC-4 / QLT-95 (2): a failed apt-get update ends the try at once: no download from that mirror, and try 2 uses archive.ubuntu.com', () => {
    const run = outcome('updateFailsOnce');
    expect(run.status).toBe(0);
    expect(aptCalls('updateFailsOnce')).toEqual(MISS_ON_FALLBACK);
    expect(run.output).toContain('apt-get update failed with status 100');
    expect(run.output).toContain(`Try 2 of 3, mirror ${FALLBACK_MIRROR}.`);
    expect(run.cachedAfter).toEqual(KEPT);
    expect(npxCalls('updateFailsOnce').at(-1)).toBe(BROWSER);
  });

  it('AC-4: an apt-get update that reaches its time limit also ends the try without a download', () => {
    const run = outcome('updateStallsOnce');
    expect(run.status).toBe(0);
    expect(aptCalls('updateStallsOnce')).toEqual(MISS_ON_FALLBACK);
    expect(run.output).toContain(`apt-get update reached its ${LIMIT_SECONDS} s limit`);
  });

  it('AC-4: a download that reaches its time limit is stopped and the next try runs on archive.ubuntu.com', () => {
    const run = outcome('downloadStallsOnce');
    expect(run.status).toBe(0);
    expect(aptCalls('downloadStallsOnce')).toEqual([update(ON_IMAGE), download(ON_IMAGE), update(ON_FALLBACK), download(ON_FALLBACK), offline(ON_FALLBACK)]);
    expect(run.output).toContain(`The download reached its ${LIMIT_SECONDS} s limit`);
  });

  it('QLT-95 (3): --error-on=any is on the update only, and all three commands of a try carry the same three -o options', () => {
    for (const [name] of SCENARIOS) {
      for (const call of rawAptCalls(name)) {
        expect(call, `${name}: ${call}`).toMatch(VIEW_OPTIONS);
        expect(call.includes('--error-on=any'), `${name}: ${call}`).toBe(call.startsWith('apt-get update '));
      }
    }
    // One view for the three commands of a try, and a new one for the next try.
    const base = (call: string): string | undefined => VIEW_OPTIONS.exec(call)?.[1];
    expect(new Set(rawAptCalls('miss').map(base)).size).toBe(1);
    expect(new Set(rawAptCalls('updateFailsOnce').map(base)).size).toBe(2);
    expect(new Set(rawAptCalls('everyUpdateFails').map(base)).size).toBe(3);
    expect(rawAptCalls('miss')[0]).toContain('-o Dir::Etc::SourceList=/dev/null');
  });

  it('QLT-95 (4) / QLT-93: the view of each try names only that try\'s mirror and keeps Signed-By; the fallback replaces mirror+file: in every stanza', () => {
    const fallback = outcome('everyUpdateFails').views;
    expect(fallback).toHaveLength(3);
    const [first, second, third] = fallback;
    expect(first?.content).toBe(IMAGE_SOURCES);
    for (const view of [second, third]) {
      const text = view?.content ?? '';
      expect(text.split('\n').filter((line) => line.startsWith('URIs:')), 'every stanza').toEqual([`URIs: ${FALLBACK_URIS}`, `URIs: ${FALLBACK_URIS}`]);
      expect(text).not.toContain('mirror+file:');
      expect(text.split('\n').filter((line) => line.startsWith('Signed-By:')), 'Signed-By is kept').toEqual([SIGNED_BY, SIGNED_BY]);
      expect(text).toContain('Suites: noble noble-updates');
      expect(text).toContain('Suites: noble-security');
    }
  });

  it('QLT-95: an apt view holds the Ubuntu source and nothing else: a third-party repository of the image is never read', () => {
    for (const [name] of SCENARIOS) {
      for (const view of outcome(name).views) {
        expect(view.files, name).toBe('ubuntu.sources');
        expect(view.content, name).not.toContain('packages.example.test');
      }
    }
  });

  it('QLT-95 (5): nothing under the runner\'s sources.list.d changes, in any scenario', () => {
    for (const [name, scenario] of SCENARIOS) {
      const expected = new Map<string, string>([['other.list', `${OTHER_SOURCE}\n`]]);
      if (scenario.noImageSources !== true) expected.set('ubuntu.sources', IMAGE_SOURCES);
      expect(outcome(name).runnerSourcesAfter, name).toEqual(expected);
    }
  });

  it('AC-5 / QLT-95 (6): when every update fails there are three tries, no download at all, and a message that names both mirrors', () => {
    const run = outcome('everyUpdateFails');
    expect(run.status).not.toBe(0);
    expect(aptCalls('everyUpdateFails')).toEqual([update(ON_IMAGE), update(ON_FALLBACK), update(ON_FALLBACK)]);
    expect(run.output).toContain(`::error::The system packages could not be downloaded in 3 tries (mirrors tried: ${FIRST_URIS}, ${FALLBACK_MIRROR}, ${FALLBACK_MIRROR}).`);
    expect(run.output).toContain('Nothing was installed.');
  });

  it('AC-5: when every download fails or stalls there are three tries, nothing is installed, and nothing is cached or run after', () => {
    const run = outcome('everyDownloadFails');
    expect(run.status).not.toBe(0);
    expect(aptCalls('everyDownloadFails')).toEqual([update(ON_IMAGE), download(ON_IMAGE), update(ON_FALLBACK), download(ON_FALLBACK), update(ON_FALLBACK), download(ON_FALLBACK)]);
    expect(run.calls).not.toContain(offline(ON_IMAGE));
    expect(run.output).toContain(`mirrors tried: ${FIRST_URIS}, ${FALLBACK_MIRROR}, ${FALLBACK_MIRROR}`);
    expect(npxCalls('everyDownloadFails')).toEqual([DRY_RUN]);
    expect(run.cachedAfter).toEqual([]);
  });

  it('a failed offline install fails the step (nothing is cached, the browser install is not reached)', () => {
    const run = outcome('offlineInstallFails');
    expect(run.status).not.toBe(0);
    expect(aptCalls('offlineInstallFails')).toEqual(MISS_ON_IMAGE);
    expect(npxCalls('offlineInstallFails')).toEqual([DRY_RUN]);
    expect(run.cachedAfter).toEqual([]);
  });

  it('G7 round 2: every apt view is removed with sudo, because apt (root) leaves root-owned files in it that the runner user cannot remove', () => {
    for (const name of ['miss', 'updateFailsOnce', 'everyUpdateFails', 'everyDownloadFails'] as const) {
      const run = outcome(name);
      // One removal for each view that a later try replaces, and one at exit for the last view.
      expect(run.sudoRemovals.length, name).toBeGreaterThanOrEqual(run.views.length);
    }
    expect(outcome('miss').sudoRemovals).toHaveLength(1);
    expect(outcome('hit').sudoRemovals, 'a hit makes no view').toEqual([]);
  });

  it('STD-04: no temporary file or apt view is left behind, after a good run or a failed install', () => {
    for (const [name] of SCENARIOS) expect(outcome(name).leftover, name).toEqual([]);
  });
});
