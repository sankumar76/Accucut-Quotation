import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { posix, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * DEF-015 (AQP-206), test strategy 10.6: scripts/ci/playwright-system-deps.sh installs the browser's system packages
 * from a cache without a network, falls back to a bounded normal install when the cache is empty or bad, and keeps
 * what that install downloaded. The script runs here against fake `sudo`, `dpkg` and `npx` programs that log their
 * calls, so no package is installed and nothing is downloaded. The real apt run is shown by the CI logs.
 */

const SCRIPT = fileURLToPath(new URL('../../scripts/ci/playwright-system-deps.sh', import.meta.url));
const BASH_AVAILABLE = spawnSync('bash', ['--version']).error === undefined;
// posix.join keeps forward slashes on Windows too (see beforeEach).
const join = posix.join;

describe.skipIf(!BASH_AVAILABLE)('scripts/ci/playwright-system-deps.sh', () => {
  let work = '';
  let cacheDir = '';
  let archivesDir = '';
  let boundsFile = '';
  let callsFile = '';

  beforeEach(() => {
    // Forward slashes everywhere: bash on a Windows checkout reads a backslash in a glob as an escape.
    work = mkdtempSync(join(tmpdir(), 'pw-deps-')).split(sep).join('/');
    const bin = join(work, 'bin');
    cacheDir = join(work, 'cache');
    archivesDir = join(work, 'archives');
    boundsFile = join(work, '99-ci-bounds');
    callsFile = join(work, 'calls.log');
    mkdirSync(bin);
    mkdirSync(archivesDir);
    writeFileSync(callsFile, '');
    const fakes: Record<string, string> = {
      sudo: 'exec "$@"',
      // `dpkg --configure -a` always works; `dpkg -i` fails when the test asks it to.
      dpkg: 'echo "dpkg $*" >> "$CALLS"; [ "$1" = "--configure" ] && exit 0; exit "${FAKE_DPKG_EXIT:-0}"',
      // install-deps "downloads" one package into the apt cache, as apt-get does.
      npx: 'echo "npx $*" >> "$CALLS"; [ "$2" = "install-deps" ] && : > "$APT_ARCHIVES_DIR/downloaded.deb"; exit 0',
    };
    for (const [name, body] of Object.entries(fakes)) {
      const path = join(bin, name);
      writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
      chmodSync(path, 0o755);
    }
    writeFileSync(join(archivesDir, 'already-on-the-image.deb'), '');
  });

  afterEach(() => {
    rmSync(work, { recursive: true, force: true });
  });

  function run(cacheHit: 'true' | 'false', dpkgExit = 0): { status: number | null; output: string } {
    const bin = join(work, 'bin');
    const result = spawnSync('bash', [SCRIPT, cacheDir], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env['PATH'] ?? ''}`,
        CALLS: callsFile,
        PLAYWRIGHT_DEBS_CACHE_HIT: cacheHit,
        APT_BOUNDS_FILE: boundsFile,
        APT_ARCHIVES_DIR: archivesDir,
        FAKE_DPKG_EXIT: String(dpkgExit),
      },
    });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  }

  const calls = (): string[] => readFileSync(callsFile, 'utf8').split('\n').filter((line) => line !== '');
  const cached = (): string[] => readdirSync(cacheDir).sort();

  it('a hit installs the cached packages with dpkg, with no apt, no download and no bound file', () => {
    mkdirSync(cacheDir);
    writeFileSync(join(cacheDir, 'libfoo.deb'), '');
    const { status } = run('true');
    expect(status).toBe(0);
    expect(calls().filter((call) => call.startsWith('dpkg -i'))).toHaveLength(1);
    expect(calls().join('\n')).toContain('libfoo.deb');
    expect(calls().join('\n')).not.toContain('install-deps');
    expect(existsSync(boundsFile)).toBe(false);
    expect(calls().at(-1)).toBe('npx playwright install chromium');
  });

  it('a miss bounds apt (20 s timeout, 3 retries), installs the system packages, then the browser', () => {
    const { status } = run('false');
    expect(status).toBe(0);
    const bounds = readFileSync(boundsFile, 'utf8');
    expect(bounds).toContain('Acquire::http::Timeout "20";');
    expect(bounds).toContain('Acquire::Retries "3";');
    expect(calls().filter((call) => call.startsWith('dpkg -i'))).toEqual([]);
    expect(calls().filter((call) => call.startsWith('npx'))).toEqual(['npx playwright install-deps chromium', 'npx playwright install chromium']);
  });

  it('a miss keeps the packages the install downloaded, and only those', () => {
    run('false');
    expect(cached()).toEqual(['downloaded.deb']);
  });

  it('a hit whose dpkg install fails falls back to the bounded normal install and still ends green', () => {
    mkdirSync(cacheDir);
    writeFileSync(join(cacheDir, 'corrupt.deb'), 'not a package');
    const { status, output } = run('true', 1);
    expect(status).toBe(0);
    expect(output).toContain('::warning::The cached system packages could not be installed');
    expect(existsSync(boundsFile)).toBe(true);
    expect(calls().filter((call) => call.startsWith('npx'))).toEqual(['npx playwright install-deps chromium', 'npx playwright install chromium']);
    expect(cached()).toEqual(['downloaded.deb']);
  });

  it('a hit with an empty cache directory also takes the normal install, not a failed dpkg call', () => {
    mkdirSync(cacheDir);
    const { status } = run('true');
    expect(status).toBe(0);
    expect(calls().filter((call) => call.startsWith('dpkg -i'))).toEqual([]);
    expect(calls()).toContain('npx playwright install-deps chromium');
  });

  it('a failing normal install fails the step, so a real outage is red and not hidden', () => {
    writeFileSync(join(work, 'bin', 'npx'), '#!/usr/bin/env bash\nexit 1\n');
    expect(run('false').status).not.toBe(0);
  });
});
