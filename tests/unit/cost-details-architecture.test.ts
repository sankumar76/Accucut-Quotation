import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STORY-06.03 AC-6 and AC-8 (NFR-002; architecture sections 4.8, 4.9 and 10): what keeps the formulas, rates and costs of SCR-07 where they belong, written as scans of the source tree so a later change
 * that goes around a rule fails here and not in review.
 *   - **Only the Lead's and the Admin's page loads the screen.** The folder of the screen is imported by one file, the page of `/estimates/[code]/costs/[slNo]`, whose manifest row lists no Engineer, and
 *     nothing of the Engineer's workspace, its page or the review imports the screen, the service, the schema or the working.
 *   - **The page guards before it reads**, and has no loading boundary that would answer 200 before `forbidden()` and `notFound()` run.
 *   - **One script, and it holds nothing.** The only client component of the folder is the phone accordion, which takes no prop, imports nothing but React and names no figure.
 *   - **Read-only (AC-6).** No form control, no editable element and no handler of a change anywhere in the folder.
 * Every scan has a control that plants a fault in a copy of the text and sees it found.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC = join(ROOT, 'src');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (path.includes(`${join('src', 'generated')}`)) return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const ALL = sourceFiles(SRC).map((path) => ({ path: relative(ROOT, path).replaceAll('\\', '/'), text: readFileSync(path, 'utf8') }));
type SourceFile = (typeof ALL)[number];
const pathsMatching = (files: ReadonlyArray<SourceFile>, pattern: RegExp): string[] => files.filter((file) => pattern.test(file.text)).map((file) => file.path);
const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

const FOLDER = 'src/components/features/cost-details/';
const PAGE = 'src/app/(portal)/estimates/[code]/costs/[slNo]/page.tsx';
const ROUTE = 'src/app/api/v1/estimates/[id]/nodes/[nodeId]/costs/route.ts';
const SERVICE = 'src/server/services/cost-details-service.ts';
const COMPOSITION = 'src/server/composition.ts';
const folderFiles = ALL.filter((file) => file.path.startsWith(FOLDER));

describe('AC-8: nothing of SCR-07 reaches the Engineer', () => {
  it('only the costs page imports a file of the screen\'s folder, and nothing else of src does', () => {
    const importers = ALL.filter((file) => !file.path.startsWith(FOLDER) && /features\/cost-details\//.test(file.text)).map((file) => file.path);
    expect(importers).toEqual([PAGE]);
  });

  it('only the route, the page and the composition name the cost details service; only the service names the working; only the screen, the page, the route and the service name the schema', () => {
    expect(pathsMatching(ALL, /\bgetCostDetailsService\b/).sort()).toEqual([COMPOSITION, PAGE, ROUTE].sort());
    expect(pathsMatching(ALL, /\bcost-working'/)).toEqual([SERVICE]);
    // The barrel re-exports it by `./node-costs`, which an Engineer view may not import (the lint refuses the barrel).
    expect(pathsMatching(ALL, /schemas\/node-costs'/).filter((path) => !path.startsWith(FOLDER)).sort()).toEqual([PAGE, ROUTE, SERVICE].sort());
  });

  it('the Engineer\'s page, its workspace and the review import nothing of the screen, its service, its schema or its working', () => {
    const forbidden = /cost-details|node-costs|getCostDetailsService|cost-working/;
    const engineerSide = ALL.filter(
      (file) =>
        file.path === 'src/app/(portal)/estimates/[code]/page.tsx' ||
        file.path === 'src/app/(portal)/estimates/[code]/review-page.tsx' ||
        file.path.startsWith('src/components/features/estimate-workspace/') ||
        file.path.startsWith('src/components/features/estimate-review/'),
    );
    expect(engineerSide.length).toBeGreaterThan(10);
    // The review links to the screen by its address (`/costs/`), which is a path and not an import.
    expect(engineerSide.filter((file) => forbidden.test(stripComments(file.text))).map((file) => file.path)).toEqual([]);
  });

  it('the costs page checks the role with its own address first, and reads nothing before it', () => {
    const page = stripComments(ALL.find((file) => file.path === PAGE)?.text ?? '');
    expect(page.length).toBeGreaterThan(100);
    const guard = page.indexOf("authorizePage('/estimates/[code]/costs/[slNo]')");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(page.indexOf('getEstimateService()'));
    expect(guard).toBeLessThan(page.indexOf('getCostDetailsService()'));
    expect(page.indexOf('getEstimateService()')).toBeLessThan(page.indexOf('getCostDetailsService()'));
  });

  it('there is no loading boundary beside the page: it would answer 200 before forbidden() and notFound() run (TD-06)', () => {
    const beside = ALL.filter((file) => file.path.startsWith('src/app/(portal)/estimates/[code]/costs/') && !file.path.endsWith('/page.tsx')).map((file) => file.path);
    expect(beside).toEqual([]);
    expect(statSync(join(SRC, 'app', '(portal)', 'estimates', '[code]', 'costs', '[slNo]')).isDirectory()).toBe(true);
    expect(readdirSync(join(SRC, 'app', '(portal)', 'estimates', '[code]', 'costs', '[slNo]'))).toEqual(['page.tsx']);
  });

  it('the page is a server component and the route is a read with one schema', () => {
    expect(pathsMatching(ALL.filter((file) => file.path === PAGE), /^\s*['"]use client['"]/m)).toEqual([]);
    const route = ALL.find((file) => file.path === ROUTE)?.text ?? '';
    expect(route).toMatch(/output: nodeCostsSchema/);
    expect(route.match(/export const (GET|POST|PUT|PATCH|DELETE)\b/g)).toEqual(['export const GET']);
  });

  it('control: a static import of the screen in the Engineer\'s page is found by the same scan', () => {
    const planted = "import { CostDetails } from '@/components/features/cost-details/cost-details';";
    expect(planted).toMatch(/features\/cost-details\//);
    expect(planted).toMatch(/cost-details|node-costs|getCostDetailsService|cost-working/);
  });
});

describe('the only script of the screen is the phone accordion, and it holds nothing', () => {
  const clients = folderFiles.filter((file) => /^\s*['"]use client['"]/m.test(file.text));

  it('one file of the folder is a client component, `phone-stages.tsx`', () => {
    expect(folderFiles.length).toBeGreaterThanOrEqual(5);
    expect(clients.map((file) => file.path)).toEqual([`${FOLDER}phone-stages.tsx`]);
  });

  it('it takes no prop, renders nothing, and imports nothing but React: no schema, no figure, no text of the screen', () => {
    const text = stripComments(clients[0]?.text ?? '');
    const imports = [...text.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
    expect(imports).toEqual(['react']);
    expect(text).toMatch(/export function PhoneStages\(\) \{/);
    expect(text).toMatch(/return null;/);
    expect(text).not.toMatch(/node-costs|cost-details-texts|money|formula|working/i);
  });

  it('no other file of the folder uses a hook, so nothing else is script', () => {
    const others = folderFiles.filter((file) => !clients.includes(file));
    expect(others.filter((file) => /\buse(State|Effect|Ref|Memo|Callback|Reducer|Transition)\b|\bnext\/dynamic\b|React\.lazy/.test(file.text)).map((file) => file.path)).toEqual([]);
  });

  it('control: a client component that imports the schema is found', () => {
    const planted = "'use client';\nimport { nodeCostsSchema } from '@/server/views/schemas/node-costs';";
    expect(planted).toMatch(/node-costs/);
  });
});

describe('AC-6: read-only, with no edit control for a formula', () => {
  const EDITABLE = /<(input|textarea|select|form|button)\b|contentEditable|\bonChange\b|\bonSubmit\b|\bonInput\b|\bdefaultValue\b|\bcontentEditable\b/;

  it('no file of the folder, nor the page, draws a form control, an editable element or a handler of a change', () => {
    const screen = [...folderFiles, ...ALL.filter((file) => file.path === PAGE)];
    expect(screen.filter((file) => EDITABLE.test(stripComments(file.text))).map((file) => file.path)).toEqual([]);
  });

  it('control: a planted input and a planted handler are found by the same scan', () => {
    expect('<input type="text" />').toMatch(EDITABLE);
    expect('<td contentEditable>').toMatch(EDITABLE);
    expect('<Foo onChange={x} />').toMatch(EDITABLE);
  });

  it('the route exports no method that changes anything, and no formula is saved through the screen\'s files', () => {
    const text = folderFiles.map((file) => stripComments(file.text)).join('\n');
    expect(text).not.toMatch(/method: ['"](POST|PUT|PATCH|DELETE)['"]|fetch\(/);
  });
});
