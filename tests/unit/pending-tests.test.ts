import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { findPendingTests } from '../../scripts/lib/pending-tests';

/**
 * AC-8 (test strategy section 5.6, control 4): a quantity test file must not be pending, skipped,
 * expected to fail or focused. The planted strings are assembled here, so this file never contains
 * the markers itself and the real scan below cannot trip on it.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const QUANTITY_DIRECTORIES = ['tests/unit/quantity', 'tests/integration/quantity'];

const marker = (call: string, modifier: string): string => `${call}.${modifier}`;

function testFilesUnder(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return testFilesUnder(path);
    return /\.test\.ts$/.test(name) ? [path] : [];
  });
}

describe('findPendingTests scanner (AC-8)', () => {
  it.each(['todo', 'skip', 'skipIf', 'fails', 'only'])('AC-8 (negative control): reports a planted %s', (modifier) => {
    const source = `import { it } from 'vitest';\n${marker('it', modifier)}('CE-1 is 30', () => {});\n`;
    expect(findPendingTests(source)).toEqual([{ line: 2, text: `${marker('it', modifier)}('CE-1 is 30', () => {});` }]);
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

describe('quantity tests are never pending (AC-8)', () => {
  it('AC-8: no file under tests/unit/quantity or tests/integration/quantity is skipped, pending or focused', () => {
    const findings = QUANTITY_DIRECTORIES.flatMap((directory) =>
      testFilesUnder(join(ROOT, directory)).flatMap((file) =>
        findPendingTests(readFileSync(file, 'utf8')).map((finding) => `${file}:${finding.line} ${finding.text}`),
      ),
    );
    expect(findings).toEqual([]);
  });
});
