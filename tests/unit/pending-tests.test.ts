import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { findPendingTests, findPendingTestsInDirectory, QUANTITY_TEST_DIRECTORIES } from '../../scripts/lib/pending-tests';

/**
 * AC-8 (test strategy section 5.6, control 4): a quantity test file must not be pending, skipped,
 * conditionally run, expected to fail or focused. The planted strings are assembled here, so this file
 * never contains the markers itself and the real scan below cannot trip on it.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const marker = (call: string, modifier: string): string => `${call}.${modifier}`;
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('findPendingTests scanner (AC-8)', () => {
  it.each(['todo', 'skip', 'skipIf', 'runIf', 'fails', 'only'])('AC-8 (negative control): reports a planted %s', (modifier) => {
    const source = `import { it } from 'vitest';\n${marker('it', modifier)}('CE-1 is 30', () => {});\n`;
    expect(findPendingTests(source)).toEqual([{ line: 2, text: `${marker('it', modifier)}('CE-1 is 30', () => {});` }]);
  });

  it('QLT-14: reports runIf at describe level, a bracketed modifier, any option value and a destructured skip', () => {
    expect(findPendingTests(`${marker('describe', 'runIf')}(false)('CE-9', () => {});`)).toHaveLength(1);
    expect(findPendingTests(`it['skip']('CE-1', () => {});`)).toHaveLength(1);
    expect(findPendingTests("it('CE-2', { skip: isCi }, () => {});")).toHaveLength(1);
    expect(findPendingTests("it('CE-2', { todo: false }, () => {});")).toHaveLength(1);
    expect(findPendingTests("it('CE-3', ({ skip }) => { skip(); });")).toHaveLength(1);
  });

  it('AC-8: reports a describe-level skip and an options-object skip', () => {
    expect(findPendingTests(`${marker('describe', 'skip')}('CE-9', () => {});`)).toHaveLength(1);
    expect(findPendingTests("it('CE-2', { skip: true }, () => {});")).toHaveLength(1);
  });

  it('AC-8: reports every occurrence with its line number', () => {
    const source = [marker('it', 'todo'), 'ok', marker('test', 'only')].join('\n');
    expect(findPendingTests(source).map((finding) => finding.line)).toEqual([1, 3]);
  });

  it('AC-8: leaves an ordinary asserted test alone', () => {
    expect(findPendingTests("it('CE-1 is 30', () => { expect(30).toBe(30); });")).toEqual([]);
  });
});

describe('findPendingTestsInDirectory (QLT-14)', () => {
  function folderWith(files: Record<string, string>): string {
    const directory = mkdtempSync(join(tmpdir(), 'aqp-pending-'));
    directories.push(directory);
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(directory, path)), { recursive: true });
      writeFileSync(join(directory, path), content);
    }
    return directory;
  }

  it('walks nested folders and reports the planted file with its path and line', () => {
    const directory = folderWith({
      'quantity-cases.test.ts': "it('CE-1 is 30', () => { expect(30).toBe(30); });\n",
      'nested/deeper/ce-9.test.ts': `import { it } from 'vitest';\n${marker('it', 'todo')}('CE-9 variant A');\n`,
      'nested/helper.ts': `${marker('it', 'skip')}('not a test file');\n`,
    });
    expect(findPendingTestsInDirectory(directory)).toEqual([
      { file: 'nested/deeper/ce-9.test.ts', line: 2, text: `${marker('it', 'todo')}('CE-9 variant A');` },
    ]);
  });

  it('finds nothing in an empty folder and nothing in a folder that does not exist yet', () => {
    expect(findPendingTestsInDirectory(folderWith({}))).toEqual([]);
    expect(findPendingTestsInDirectory(join(tmpdir(), 'aqp-no-such-quantity-directory'))).toEqual([]);
  });
});

describe('quantity tests are never pending (AC-8)', () => {
  it('QLT-14: the scanned directories sit under real test folders, so a typo in a name cannot hide a file', () => {
    for (const directory of QUANTITY_TEST_DIRECTORIES) {
      expect(existsSync(join(ROOT, dirname(directory))), `${dirname(directory)} must exist`).toBe(true);
    }
    expect(QUANTITY_TEST_DIRECTORIES).toEqual(['tests/unit/quantity', 'tests/integration/quantity']);
  });

  it('AC-8: no file under tests/unit/quantity or tests/integration/quantity is skipped, pending or focused', () => {
    const findings = QUANTITY_TEST_DIRECTORIES.flatMap((directory) =>
      findPendingTestsInDirectory(join(ROOT, directory)).map((finding) => `${directory}/${finding.file}:${finding.line} ${finding.text}`),
    );
    expect(findings).toEqual([]);
  });
});
