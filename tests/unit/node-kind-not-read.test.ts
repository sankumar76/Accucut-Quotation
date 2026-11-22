import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * AQP-403 AC-6 and AC-9 (architecture 4.12 e, "Calculation" and "Excel"): the kind of a row is a fact about the tree and nothing else. The calculation reads the inputs and the places, every kind
 * has the same eight sections and the same completeness rule, and the Excel file has no kind column, so a legacy tree deeper than the kinds allow calculates and exports exactly as before.
 * This is a source guard: a figure or a worksheet that started to depend on the kind would have to name it, and these files must not.
 */

const ROOT = fileURLToPath(new URL('../../src/', import.meta.url));

function sourcesIn(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourcesIn(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const CALCULATION_AND_EXPORT = [
  ...sourcesIn(join(ROOT, 'server/export')),
  ...sourcesIn(join(ROOT, 'lib/formula')),
  join(ROOT, 'server/services/calculation-service.ts'),
  join(ROOT, 'server/services/export-service.ts'),
  join(ROOT, 'lib/estimate/row-calculator.ts'),
  join(ROOT, 'lib/estimate/row-outputs.ts'),
  join(ROOT, 'lib/estimate/part-completeness.ts'),
];

describe('the calculation, the completeness rule and the Excel export do not read the node kind', () => {
  it('finds the files it guards', () => {
    expect(CALCULATION_AND_EXPORT.length).toBeGreaterThan(8);
  });

  it.each(CALCULATION_AND_EXPORT.map((path) => [path.slice(ROOT.length), path] as const))('%s names no node kind', (_name, path) => {
    expect(readFileSync(path, 'utf8')).not.toMatch(/nodeKind|node_kind|node-kinds|NODE_KINDS|ALLOWED_CHILDREN/);
  });
});
