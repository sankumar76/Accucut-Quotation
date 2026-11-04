import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  findLicenceViolations,
  isAcceptableExpression,
  LICENCE_EXCEPTIONS,
  type PackageLock,
} from '../../scripts/lib/licences';

/** AC-4 stage 8: licence allow-list with the named exceptions of architecture section 11. */

const lockSchema = z.object({ packages: z.record(z.string(), z.object({ license: z.string().optional() })) });
const LOCKFILE = fileURLToPath(new URL('../../package-lock.json', import.meta.url));

const lockOf = (entries: Record<string, string | undefined>): PackageLock => ({
  packages: {
    '': {},
    ...Object.fromEntries(Object.entries(entries).map(([name, license]) => [`node_modules/${name}`, { license }])),
  },
});

describe('isAcceptableExpression', () => {
  it.each(['MIT', 'Apache-2.0', 'MIT/X11', 'MIT and ISC', '(MIT AND Zlib)', '(MIT OR GPL-3.0-or-later)', 'GPL-3.0-only OR MIT'])(
    'accepts %s',
    (expression) => expect(isAcceptableExpression(expression)).toBe(true),
  );

  it.each(['GPL-3.0-or-later', 'AGPL-3.0-only', 'LGPL-3.0-or-later', 'MIT AND GPL-3.0-only', '', 'SEE LICENSE IN LICENSE.md'])(
    'rejects "%s"',
    (expression) => expect(isAcceptableExpression(expression)).toBe(false),
  );

  it('handles nesting', () => {
    expect(isAcceptableExpression('(GPL-3.0-only OR (MIT AND ISC)) AND BSD-3-Clause')).toBe(true);
    expect(isAcceptableExpression('(GPL-3.0-only OR (MIT AND AGPL-3.0-only)) AND BSD-3-Clause')).toBe(false);
  });
});

describe('findLicenceViolations (AC-4 stage 8)', () => {
  it('reports a package with a licence that is not allowed', () => {
    const lock = lockOf({ 'fine-package': 'MIT', 'copyleft-package': 'GPL-3.0-only', 'unknown-package': undefined });
    expect(findLicenceViolations(lock)).toEqual([
      { name: 'copyleft-package', licence: 'GPL-3.0-only' },
      { name: 'unknown-package', licence: '' },
    ]);
  });

  it('uses the name of a nested package', () => {
    const lock: PackageLock = { packages: { 'node_modules/a/node_modules/bad': { license: 'GPL-3.0-only' } } };
    expect(findLicenceViolations(lock)).toEqual([{ name: 'bad', licence: 'GPL-3.0-only' }]);
  });

  it('lets the named exceptions through, by exact name and by prefix', () => {
    const lock = lockOf({
      elkjs: 'EPL-2.0',
      buffers: undefined,
      '@img/sharp-libvips-linux-x64': 'LGPL-3.0-or-later',
      '@img/sharp-win32-x64': 'Apache-2.0 AND LGPL-3.0-or-later',
    });
    expect(findLicenceViolations(lock)).toEqual([]);
  });

  it('STORY-10.10 AC-6: parse-cache-control (no licence field, a BSD licence file) is a named exception with the architect\'s ruling, and only by exact name', () => {
    const exception = LICENCE_EXCEPTIONS.find(({ name }) => name === 'parse-cache-control');
    expect(exception?.reason).toContain('architecture v0.15 section 11');
    expect(findLicenceViolations(lockOf({ 'parse-cache-control': undefined }))).toEqual([]);
    expect(findLicenceViolations(lockOf({ 'parse-cache-control-extra': undefined }))).toHaveLength(1);
  });

  it('an exception does not cover a similarly named package', () => {
    expect(findLicenceViolations(lockOf({ 'elkjs-extra': 'EPL-2.0', '@img/other': 'LGPL-3.0-or-later' }))).toHaveLength(2);
  });

  it('every named exception carries a reason', () => {
    for (const exception of LICENCE_EXCEPTIONS) expect(exception.reason.length).toBeGreaterThan(20);
  });

  it('passes on the committed lockfile', () => {
    const lock = lockSchema.parse(JSON.parse(readFileSync(LOCKFILE, 'utf8')));
    expect(findLicenceViolations(lock)).toEqual([]);
  });
});
