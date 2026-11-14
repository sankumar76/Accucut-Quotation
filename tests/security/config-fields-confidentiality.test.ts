import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { forbiddenStrings } from '../support/canary-masters';
import { nonEmpty } from '../support/security-loops';
import { seedFormulaTexts } from '../support/seed-formula-texts';

/**
 * STORY-08.01 AC-5 (NFR-002), the static half: a formula and a rate name must reach no Engineer, through a page, a route or a script. The live half is the response scan
 * (`engineer-refused-before-lookup.test.ts`, and `tests/e2e/canary-scan.spec.ts`, which also reads every script an Engineer's pages load). Two things are held here, from the source:
 *   1. The code that draws SCR-17 holds no formula text and no rate or operand name of its own. A formula reaches the browser only in the answer of a route that the Admin and the Lead
 *      alone can call, so no script of the portal, in any chunk, carries one: a chunk scan of an Engineer's pages could never find one that was not in a file.
 *   2. Nothing an Engineer can reach imports the Configuration feature, its client module, the read service or its schema file: the importers are listed, and a new one fails here until
 *      someone decides it is not an Engineer's.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function sourceFilesIn(directory: string): string[] {
  const path = join(ROOT, directory);
  return readdirSync(path).flatMap((name) => {
    const child = join(path, name);
    if (statSync(child).isDirectory()) return sourceFilesIn(relative(ROOT, child));
    return /\.(ts|tsx)$/.test(name) ? [relative(ROOT, child).split('\\').join('/')] : [];
  });
}

const read = (file: string): string => readFileSync(join(ROOT, file), 'utf8');

/** The code of SCR-17 that is sent to a browser or builds what is. */
const SCR_17_FILES: ReadonlyArray<string> = nonEmpty('files of the SCR-17 screen', [
  ...sourceFilesIn('src/components/features/config'),
  ...sourceFilesIn('src/lib/config'),
  ...sourceFilesIn('src/app/(portal)/config'),
]);

describe('the code of SCR-17 holds no formula and no rate name (AC-5)', () => {
  const secrets = forbiddenStrings(seedFormulaTexts()).filter((entry) => ['rate or operand name', 'formula marker', 'formula text'].includes(entry.reason));

  it('has names, markers and formulas to look for', () => {
    expect(secrets.length).toBeGreaterThan(40);
    expect(secrets.map((entry) => entry.text)).toEqual(expect.arrayContaining(['Cutting-Rate-per-Sec', '{{rate:', 'IF(Material-Specific-Gravity > 0, M - N, 0)']));
  });

  it.each(SCR_17_FILES)('%s holds none of them', (file) => {
    const source = read(file);
    expect(secrets.filter((entry) => source.includes(entry.text)).map((entry) => entry.text)).toEqual([]);
  });

  it('the control: the search does find one in a file that holds it', () => {
    const planted = `export const x = '${secrets.find((entry) => entry.reason === 'rate or operand name')?.text ?? ''}';`;
    expect(secrets.some((entry) => planted.includes(entry.text))).toBe(true);
  });
});

describe('only the Configuration routes, page and composition import the Configuration feature (AC-5)', () => {
  /** What an Engineer-reachable file must never import: the screen, the client module and the list helpers, the read service, and the schema file. */
  const RESTRICTED_SPECIFIERS = [
    'features/config/',
    'lib/config/',
    'services/config-read-service',
    'schemas/config',
  ];

  /** The files that may, and why. */
  const ALLOWED_IMPORTERS: ReadonlyArray<string> = [
    'src/app/(portal)/config/fields/error.tsx',
    'src/app/(portal)/config/fields/page.tsx',
    'src/app/api/v1/config/current/route.ts',
    'src/app/api/v1/config/fields/route.ts',
    'src/components/features/config/fields-screen.tsx',
    'src/components/features/config/fields-table.tsx',
    'src/server/composition.ts',
    'src/server/services/config-read-service.ts',
    // The barrel re-exports every schema file for tests and server code; an `engineer-*` view may not import it (`engineer-import-rule.test.ts`).
    'src/server/views/schemas/index.ts',
  ];

  const importers = sourceFilesIn('src').filter((file) => {
    const source = read(file);
    return RESTRICTED_SPECIFIERS.some((specifier) => new RegExp(`from\\s+['"][^'"]*${specifier}`).test(source));
  });

  it('lists exactly the files that are allowed to', () => {
    expect(importers).toEqual(ALLOWED_IMPORTERS.filter((file) => importers.includes(file)));
    expect(importers.filter((file) => !ALLOWED_IMPORTERS.includes(file))).toEqual([]);
  });

  it('the Engineer pages and the shared layout are not among them', () => {
    for (const file of ['src/app/(portal)/layout.tsx', 'src/app/(portal)/queue/page.tsx', 'src/app/(portal)/estimates/[code]/page.tsx', 'src/app/(portal)/page.tsx']) {
      expect(importers, file).not.toContain(file);
    }
  });
});
