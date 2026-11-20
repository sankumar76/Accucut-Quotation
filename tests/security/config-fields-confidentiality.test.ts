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
    // STORY-08.02: the formula editor's page, three routes, screen and service. The page and the routes are the Admin's alone (the manifest), and the service is blocked for every Engineer view.
    'src/app/(portal)/config/fields/[id]/formula/page.tsx',
    'src/app/api/v1/config/current/route.ts',
    'src/app/api/v1/config/fields/route.ts',
    'src/app/api/v1/config/fields/[id]/formula/route.ts',
    'src/app/api/v1/config/formula-check/route.ts',
    'src/app/api/v1/config/sample-rows/route.ts',
    // STORY-08.03: the insert wizard's page, three routes (the insert is a `POST` in the file above), screen, service and schema. The page and the routes are the Admin's alone (the manifest), the service is blocked
    // for every Engineer view, and the schemas and the audit words name column labels and formulas the Admin typed.
    'src/app/(portal)/config/fields/new/page.tsx',
    'src/app/api/v1/config/fields/preview/route.ts',
    'src/app/api/v1/config/insert-options/route.ts',
    'src/components/features/config/insert-field-controls.tsx',
    'src/components/features/config/insert-field-input-fields.tsx',
    'src/components/features/config/insert-field-letters.tsx',
    'src/components/features/config/insert-field-outcome.ts',
    'src/components/features/config/insert-field-output-fields.tsx',
    'src/components/features/config/insert-field-screen.tsx',
    'src/components/features/config/insert-field-steps.tsx',
    'src/components/features/config/insert-field-wizard.tsx',
    'src/components/features/config/use-insert-wizard.ts',
    'src/server/services/audit-events.ts',
    'src/server/services/config-structure-service.ts',
    'src/server/views/schemas/config-structure.ts',
    // STORY-08.04: the delete's two routes (the dialog's own files are listed below with the screen), the pure delete and its words and audit. The routes are the Admin's alone (the manifest); the answers name formulas.
    'src/app/api/v1/config/fields/[id]/route.ts',
    'src/app/api/v1/config/fields/[id]/references/route.ts',
    'src/components/features/config/fields-screen.tsx',
    'src/components/features/config/fields-table.tsx',
    'src/components/features/config/formula-editor-screen.tsx',
    'src/components/features/config/formula-editor.tsx',
    'src/components/features/config/formula-preview.tsx',
    'src/components/features/config/suggestions.tsx',
    'src/components/features/config/use-formula-check.ts',
    'src/components/features/config/use-save-formula.ts',
    'src/server/composition.ts',
    'src/server/services/config-edit-service.ts',
    'src/server/services/config-read-service.ts',
    // The barrel re-exports every schema file for tests and server code; an `engineer-*` view may not import it (`engineer-import-rule.test.ts`).
    'src/server/views/schemas/index.ts',
  ];

  const importers = sourceFilesIn('src').filter((file) => {
    const source = read(file);
    return RESTRICTED_SPECIFIERS.some((specifier) => new RegExp(`from\\s+['"][^'"]*${specifier}`).test(source));
  });

  it('lists exactly the files that are allowed to', () => {
    // Both sides are sorted: the order `readdirSync` gives differs between Windows and Linux (a `[id]` folder comes last on one and first on the other), and the rule is about the set.
    expect([...importers].sort()).toEqual(ALLOWED_IMPORTERS.filter((file) => importers.includes(file)).sort());
    expect(importers.filter((file) => !ALLOWED_IMPORTERS.includes(file))).toEqual([]);
  });

  it('the Engineer pages and the shared layout are not among them', () => {
    for (const file of ['src/app/(portal)/layout.tsx', 'src/app/(portal)/queue/page.tsx', 'src/app/(portal)/estimates/[code]/page.tsx', 'src/app/(portal)/page.tsx']) {
      expect(importers, file).not.toContain(file);
    }
  });
});
