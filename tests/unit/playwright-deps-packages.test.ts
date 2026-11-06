import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

/**
 * AQP-216 (STORY-10.16) AC-3 and AC-6: the package-list parser of CI stage 12a, scripts/ci/playwright-deps-packages.sh.
 * It reads the output of `npx playwright install-deps --dry-run chromium` and prints the package names, or exits 1 when
 * the output holds no install command and no report, which makes stage 12a warn and take the bounded AQP-206 path.
 *
 * The inputs are invented. Each case runs once, in `beforeAll`, under the shared hook limit (a bash start is slow on a
 * Windows checkout, QLT-80), and the tests read the recorded results.
 */

const PARSER = fileURLToPath(new URL('../../scripts/ci/playwright-deps-packages.sh', import.meta.url));
const BASH_AVAILABLE = spawnSync('bash', ['--version']).error === undefined;

interface Parsed {
  readonly status: number | null;
  readonly names: ReadonlyArray<string>;
  readonly stderr: string;
}

const INPUTS = {
  // The shape the architect expected (test strategy 10.6): the command Playwright would run.
  command: 'apt-get update && apt-get install -y --no-install-recommends libfoo1 libbar-dev libbaz2.0-0\n',
  commandOnItsOwnLine: 'Installing dependencies...\napt-get install -y --no-install-recommends libfoo1 libbar-dev\nDone.\n',
  emptyList: 'apt-get install -y --no-install-recommends\n',
  // The shape Playwright 1.64.1 prints on Linux (coreBundle.js, reportMissingDependenciesLinux).
  report: 'Missing system dependencies (3):\n  libasound2t64\n  libnss3\n  libxkbcommon0\n',
  reportWithNoise:
    'BEWARE: your OS is not officially supported by Playwright; installing dependencies for ubuntu24.04-x64 as a fallback.\nMissing system dependencies (2):\n  libnss3\n  libxkbcommon0\n\nunrelated line\n  not-a-package-because-the-report-ended\n',
  allInstalled: 'All system dependencies are installed.\n',
  // Nothing Playwright prints today or expects to print: the script must warn and take the bounded path.
  noInstallCommand: 'Something else entirely.\nNothing to see here.\n',
  empty: '',
  // An option or a shell word after the flag must never reach apt-get.
  unexpectedOption: 'apt-get install -y --no-install-recommends libfoo1 --allow-unauthenticated\n',
  shellWord: 'apt-get install -y --no-install-recommends libfoo1 && rm -rf x\n',
  upperCaseName: 'apt-get install -y --no-install-recommends LibFoo\n',
  reportWithOption: 'Missing system dependencies (1):\n  --allow-unauthenticated\n',
  // A package name with an architecture or a version is valid apt syntax and is kept as written.
  suffixes: 'apt-get install -y --no-install-recommends libfoo1:amd64 libbar=1.2.3-4ubuntu1 libbaz+extra\n',
  duplicates: 'apt-get install -y --no-install-recommends libfoo1 libbar libfoo1\n',
  windowsLineEnds: 'Missing system dependencies (2):\r\n  libnss3\r\n  libxkbcommon0\r\n',
  noTrailingNewline: 'apt-get install -y --no-install-recommends libfoo1 libbar',
} as const;

type InputName = keyof typeof INPUTS;

describe.skipIf(!BASH_AVAILABLE)('scripts/ci/playwright-deps-packages.sh (AQP-216 AC-3, AC-6)', () => {
  const parsed = {} as Record<InputName, Parsed>;

  beforeAll(() => {
    for (const name of Object.keys(INPUTS) as InputName[]) {
      const result = spawnSync('bash', [PARSER], { input: INPUTS[name], encoding: 'utf8' });
      parsed[name] = { status: result.status, names: result.stdout.split('\n').filter((line) => line !== ''), stderr: result.stderr };
    }
  });

  it('takes the names after --no-install-recommends in an install command', () => {
    expect(parsed.command).toMatchObject({ status: 0, names: ['libfoo1', 'libbar-dev', 'libbaz2.0-0'] });
    expect(parsed.commandOnItsOwnLine).toMatchObject({ status: 0, names: ['libfoo1', 'libbar-dev'] });
    expect(parsed.noTrailingNewline).toMatchObject({ status: 0, names: ['libfoo1', 'libbar'] });
  });

  it('an install command with no package after the flag is a valid, empty list (not a failure)', () => {
    expect(parsed.emptyList).toMatchObject({ status: 0, names: [] });
  });

  it('reads the report that Playwright 1.64.1 prints on Linux, and ignores the lines around it', () => {
    expect(parsed.report).toMatchObject({ status: 0, names: ['libasound2t64', 'libnss3', 'libxkbcommon0'] });
    expect(parsed.reportWithNoise).toMatchObject({ status: 0, names: ['libnss3', 'libxkbcommon0'] });
    expect(parsed.windowsLineEnds).toMatchObject({ status: 0, names: ['libnss3', 'libxkbcommon0'] });
  });

  it('"All system dependencies are installed." is a valid, empty list', () => {
    expect(parsed.allInstalled).toMatchObject({ status: 0, names: [] });
  });

  it('output with no install command and no report exits 1, so the script warns and takes the bounded path', () => {
    for (const name of ['noInstallCommand', 'empty'] as const) {
      expect(parsed[name].status, name).toBe(1);
      expect(parsed[name].names, name).toEqual([]);
      expect(parsed[name].stderr, name).toContain('No install command');
    }
  });

  it('an unexpected word is refused as a whole: no option or shell word can reach apt-get', () => {
    for (const name of ['unexpectedOption', 'shellWord', 'upperCaseName', 'reportWithOption'] as const) {
      expect(parsed[name].status, name).toBe(1);
      expect(parsed[name].names, name).toEqual([]);
      expect(parsed[name].stderr, name).toContain('Not a package name');
    }
  });

  it('keeps a package name with an architecture or a version suffix as written', () => {
    expect(parsed.suffixes).toMatchObject({ status: 0, names: ['libfoo1:amd64', 'libbar=1.2.3-4ubuntu1', 'libbaz+extra'] });
  });

  it('lists a package once', () => {
    expect(parsed.duplicates).toMatchObject({ status: 0, names: ['libfoo1', 'libbar'] });
  });
});
