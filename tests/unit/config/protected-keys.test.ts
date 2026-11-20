import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { isProtectedField } from '@/lib/fields/protected';
import * as fieldTypes from '@/lib/fields/types';
import { PROTECTED_FIELD_KEYS, SYSTEM_ROLES } from '@/lib/fields/types';

import { seedConfig } from '../../support/seed-config';

/**
 * STORY-08.04 AC-5: the list of keys the Admin may never delete (`PROTECTED_FIELD_KEYS`), and a guard that fails when a place in the code starts to find a field by a key that is in neither the list nor the
 * short list of keys the code only tolerates. The guard reads the source of `src/` for every `findFieldByKey(` and `columnOfKey(` call and the key it names: a constant of `types.ts`, a quoted key, or a
 * variable (which is allowed only in a file that says why). The test is itself checked against a planted call (below), so it cannot go green by finding nothing.
 */

const SRC = fileURLToPath(new URL('../../../src/', import.meta.url));

/** Keys a lookup only tolerates: the field may be missing and the answer is an empty name, never a crash or a wrong figure (`PART_NAME_KEYS`, `partNameOf`, `quantityWarnings`). They may be deleted. */
const TOLERATED_KEYS: ReadonlySet<string> = new Set(['description', 'part-no']);

/** The files that pass a key held in a variable, and where its values come from. Any other file must name its key as a constant or a quoted key. */
const VARIABLE_KEY_FILES: Readonly<Record<string, string>> = {
  'src/lib/estimate/calculate-check.ts': 'loops over PART_NAME_KEYS, the two tolerated keys',
  'src/lib/estimate/part-name.ts': 'loops over PART_NAME_KEYS, the two tolerated keys',
  'src/lib/estimate/quantity-warnings.ts': 'loops over PART_NAME_KEYS, the two tolerated keys',
  'src/server/services/exchange-rate-service.ts': 'COLUMN_KEYS, whose values are constants of types.ts that are in the protected list (asserted below)',
  'src/lib/fields/lookup.ts': 'the definition of columnOfKey',
  'src/lib/fields/registry.ts': 'the definition of findFieldByKey',
};

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

interface CallSite {
  readonly file: string;
  /** The text of the key argument. */
  readonly argument: string;
}

const CALL = /\b(?:findFieldByKey|columnOfKey)\(\s*[A-Za-z_.]+\s*,\s*([^)]+?)\s*\)/g;

/** Every lookup by key in the text of one file. The definitions (`export function findFieldByKey(document: ConfigDocument, key: string)`) have a type after the first name, so the pattern skips them. */
function callSitesIn(file: string, text: string): CallSite[] {
  return [...text.matchAll(CALL)].map((match) => ({ file, argument: match[1] ?? '' }));
}

const constants: ReadonlyMap<string, string> = new Map(Object.entries(fieldTypes).flatMap(([name, value]): Array<[string, string]> => (name.endsWith('_KEY') && typeof value === 'string' ? [[name, value]] : [])));

/** What is wrong with a call site, or `null`. */
function problemWith(site: CallSite): string | null {
  const quoted = /^'([a-z][a-z0-9-]*)'$/.exec(site.argument)?.[1];
  const key = quoted ?? constants.get(site.argument);
  if (key !== undefined) {
    return PROTECTED_FIELD_KEYS.includes(key) || TOLERATED_KEYS.has(key) ? null : `${site.file} finds the field "${key}", which is neither protected nor tolerated: add it to PROTECTED_FIELD_KEYS (types.ts)`;
  }
  if (/^[a-zA-Z_]\w*$/.test(site.argument) && VARIABLE_KEY_FILES[site.file] !== undefined) return null;
  return `${site.file} finds a field by "${site.argument}": name the key as a constant of types.ts, or list the file in VARIABLE_KEY_FILES with the reason`;
}

describe('AC-5: PROTECTED_FIELD_KEYS', () => {
  it('holds every key constant of types.ts (a key the code is written against is never left deletable), once each', () => {
    expect([...constants.values()].sort()).toEqual([...PROTECTED_FIELD_KEYS].sort());
    expect(new Set(PROTECTED_FIELD_KEYS).size).toBe(PROTECTED_FIELD_KEYS.length);
  });

  it('names the eight keys of the story, the two exchange-rate keys with constants of their own', () => {
    expect([...PROTECTED_FIELD_KEYS].sort()).toEqual(
      ['exchange-rate-eur', 'exchange-rate-usd', 'material-considered', 'material-in-drawing', 'material-rate-per-kg', 'price-per-tool-cost', 'unit-price-eur', 'unit-price-usd'].sort(),
    );
    expect(fieldTypes.EXCHANGE_RATE_USD_KEY).toBe('exchange-rate-usd');
    expect(fieldTypes.EXCHANGE_RATE_EUR_KEY).toBe('exchange-rate-eur');
  });

  it('is found in the seed registry: every protected key is a field there, and so is every system role, and each is protected by isProtectedField', () => {
    for (const key of PROTECTED_FIELD_KEYS) expect(seedConfig.fields.some((field) => field.key === key), key).toBe(true);
    for (const role of SYSTEM_ROLES) expect(seedConfig.fields.some((field) => field.systemRole === role), role).toBe(true);
    const protectedKeys = seedConfig.fields.filter(isProtectedField).map((field) => field.key);
    for (const key of PROTECTED_FIELD_KEYS) expect(protectedKeys).toContain(key);
  });

  it('does not protect a key the code only tolerates', () => {
    for (const key of TOLERATED_KEYS) expect(PROTECTED_FIELD_KEYS).not.toContain(key);
  });
});

describe('AC-5: every lookup by key names a protected or tolerated key', () => {
  const sites = sourceFiles(SRC).flatMap((path) => callSitesIn(relative(join(SRC, '..'), path).replaceAll('\\', '/'), readFileSync(path, 'utf8')));

  it('finds the lookups of the code (the scan is not empty)', () => {
    expect(sites.length).toBeGreaterThan(15);
    expect(sites.map((site) => site.argument)).toEqual(expect.arrayContaining(['MATERIAL_IN_DRAWING_KEY', 'PRICE_PER_TOOL_COST_KEY', 'UNIT_PRICE_USD_KEY', 'UNIT_PRICE_EUR_KEY', 'MATERIAL_RATE_KEY']));
  });

  it('has no lookup with a key that is neither protected nor tolerated', () => {
    expect(sites.flatMap((site) => problemWith(site) ?? [])).toEqual([]);
  });

  it('fails for a planted lookup of a key that is not in the list, of a quoted one and of a variable in a file that is not listed (the guard can fail)', () => {
    expect(problemWith({ file: 'src/lib/invented.ts', argument: "'invented-field'" })).toMatch(/neither protected nor tolerated/);
    expect(problemWith({ file: 'src/lib/invented.ts', argument: 'someKey' })).toMatch(/name the key as a constant/);
    expect(problemWith({ file: 'src/lib/invented.ts', argument: "'unit-price-usd'" })).toBeNull();
    expect(callSitesIn('src/lib/invented.ts', "const field = findFieldByKey(document, 'invented-field');")).toEqual([{ file: 'src/lib/invented.ts', argument: "'invented-field'" }]);
    expect(callSitesIn('src/lib/invented.ts', 'const column = columnOfKey(current, SOME_NEW_KEY);')).toEqual([{ file: 'src/lib/invented.ts', argument: 'SOME_NEW_KEY' }]);
  });

  it('keeps the exchange-rate service on constants: its two COLUMN_KEYS rows name constants of types.ts, not quoted keys', () => {
    const text = readFileSync(join(SRC, 'server/services/exchange-rate-service.ts'), 'utf8');
    expect(text).toContain('EXCHANGE_RATE_USD_KEY');
    expect(text).toContain('EXCHANGE_RATE_EUR_KEY');
    expect(text).not.toMatch(/'exchange-rate-(usd|eur)'/);
  });
});
