/**
 * Licence allow-list (CI stage 8, architecture section 8 "Supply chain" and section 11).
 *
 * Reads the licence of every package from `package-lock.json` and fails on any licence that is not
 * allowed, unless the package is a named exception with a reason. Exceptions are by package name and
 * come from architecture section 11 ("Licence finding"); a new one is a reviewed change to this file.
 */

export const ALLOWED_LICENCES: ReadonlySet<string> = new Set([
  'MIT',
  'MIT-0',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'BlueOak-1.0.0',
  'CC0-1.0',
  'CC-BY-4.0',
  'Unlicense',
  'Python-2.0',
  'Zlib',
  'PostgreSQL',
  // File-level copyleft: used by development tooling only (lightningcss, axe-core); the test strategy
  // lists axe as MPL-2.0 (architecture section 11, "Tests" row).
  'MPL-2.0',
]);

/** npm spellings that mean an SPDX licence already on the list above. */
const LICENCE_ALIASES: Readonly<Record<string, string>> = { 'MIT/X11': 'MIT' };

export interface LicenceException {
  /** Exact package name, or a prefix ending in `*`. */
  readonly name: string;
  readonly reason: string;
}

export const LICENCE_EXCEPTIONS: ReadonlyArray<LicenceException> = [
  {
    name: '@img/sharp-*',
    reason:
      'LGPL-3.0-or-later libvips binaries, optional dependencies of next through sharp. Not used at runtime with images.unoptimized; unmodified prebuilt binaries if installed (architecture section 11). Legal view not verified.',
  },
  {
    name: 'elkjs',
    reason:
      'EPL-2.0. Reached only through prisma > @prisma/studio-core, a development tool (npm ls elkjs, 2026-11-02). Keep it out of the runtime image (architecture section 11).',
  },
  {
    name: 'buffers',
    reason:
      'No licence field, file or README statement (0.1.1, through exceljs > unzipper > binary). Checked at scaffold as architecture section 11 asked; still not stated. Legal view not verified.',
  },
  {
    name: 'parse-cache-control',
    reason:
      'No `license` field, only the legacy `licenses` field of type BSD (1.0.1, through @lhci/cli > lighthouse; development tooling only). Its LICENSE file is the BSD 3-clause text. Solution-architect ruling on STORY-10.10 AC-6 (AQP-169 comment 10738; architecture v0.15 section 11, "Licence finding").',
  },
];

export interface LockedPackage {
  readonly license?: string | undefined;
}

export interface PackageLock {
  readonly packages: Readonly<Record<string, LockedPackage>>;
}

export interface LicenceFinding {
  readonly name: string;
  readonly licence: string;
}

function packageName(lockPath: string): string {
  const marker = 'node_modules/';
  return lockPath.slice(lockPath.lastIndexOf(marker) + marker.length);
}

function isException(name: string): boolean {
  return LICENCE_EXCEPTIONS.some((entry) =>
    entry.name.endsWith('*') ? name.startsWith(entry.name.slice(0, -1)) : name === entry.name,
  );
}

type Token = string;

function tokenise(expression: string): Token[] {
  return expression
    .replace(/\(/g, ' ( ')
    .replace(/\)/g, ' ) ')
    .split(/\s+/)
    .filter((token) => token !== '')
    .map((token) => (/^(and|or)$/i.test(token) ? token.toUpperCase() : (LICENCE_ALIASES[token] ?? token)));
}

/**
 * True if an SPDX expression is acceptable: `A OR B` needs one allowed side (the package offers the
 * choice, so the allowed one is elected), `A AND B` needs both. AND binds tighter than OR.
 */
export function isAcceptableExpression(expression: string): boolean {
  const tokens = tokenise(expression);
  let position = 0;

  const parseOr = (): boolean => {
    let result = parseAnd();
    while (tokens[position] === 'OR') {
      position += 1;
      const right = parseAnd();
      result = result || right;
    }
    return result;
  };
  const parseAnd = (): boolean => {
    let result = parseAtom();
    while (tokens[position] === 'AND') {
      position += 1;
      const right = parseAtom();
      result = result && right;
    }
    return result;
  };
  const parseAtom = (): boolean => {
    const token = tokens[position];
    position += 1;
    if (token === '(') {
      const inner = parseOr();
      position += 1; // the closing parenthesis
      return inner;
    }
    return token !== undefined && ALLOWED_LICENCES.has(token);
  };

  return tokens.length > 0 && parseOr() && position >= tokens.length;
}

/** Packages whose licence is not allowed and that are not named exceptions. */
export function findLicenceViolations(lock: PackageLock): LicenceFinding[] {
  return Object.entries(lock.packages)
    .filter(([lockPath]) => lockPath !== '')
    .map(([lockPath, entry]) => ({ name: packageName(lockPath), licence: entry.license ?? '' }))
    .filter(({ name, licence }) => !isException(name) && !isAcceptableExpression(licence));
}
