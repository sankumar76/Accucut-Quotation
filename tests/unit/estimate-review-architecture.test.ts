import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STORY-06.02 AC-5 and AC-7 (NFR-002; architecture sections 4.8 and 10): what keeps the review's figures where they belong, written as scans of the source tree so a later change that
 * goes around a rule fails here and not in review.
 *   - **Every read of a calculated figure goes through `lib/estimate/figure-state.ts`.** The two methods that read a record's figures are called by one file, and it imports the figure state and
 *     reads through `readFiguresWhenCurrent`; the Prisma accessors of the two tables are used by one file.
 *   - **No review code reaches the Engineer.** The folder of the review has no client component (so none is sent to a browser as code), and nothing outside the review imports it but the review page, which
 *     `page.tsx` loads with a dynamic `import()`; the page file imports no review code, no review service and no costs schema.
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
const pathsMatching = (files: ReadonlyArray<{ path: string; text: string }>, pattern: RegExp): string[] => files.filter((file) => pattern.test(file.text)).map((file) => file.path);

const READ_OF_FIGURES = /\b(findReviewFigures|findCalculation|findRowWorking|findExportFigures)\b/;
const PRISMA_ACCESS = /\.(calculation|calculationRow)\./;
const REPOSITORY = 'src/server/repositories/calculation-repository.ts';
const REVIEW_SERVICE = 'src/server/services/estimate-review-service.ts';
const COST_DETAILS_SERVICE = 'src/server/services/cost-details-service.ts';
const EXPORT_SERVICE = 'src/server/services/export-service.ts';

describe('AC-7: every read of a figure goes through figure-state', () => {
  it('only the calculation repository names the Prisma accessors of calculations and calculation_rows', () => {
    expect(pathsMatching(ALL, PRISMA_ACCESS)).toEqual([REPOSITORY]);
  });

  it('only the repository (which defines them), the review service, the cost details service and the export service name a method that reads a record\'s figures', () => {
    expect(pathsMatching(ALL, READ_OF_FIGURES).sort()).toEqual([REPOSITORY, REVIEW_SERVICE, COST_DETAILS_SERVICE, EXPORT_SERVICE].sort());
  });

  it('STORY-07.02: nothing under src/server/export reads a calculation or its rows, and the export service reads them only through readFiguresWhenCurrent, in one place', () => {
    // The file is built from the plain model: no file of the export folder names the tables, their repository or a method that reads figures or their state.
    const exportFolder = ALL.filter((file) => file.path.startsWith('src/server/export/'));
    expect(exportFolder.length).toBeGreaterThanOrEqual(7);
    expect(pathsMatching(exportFolder, /calculation-repository|calculationRow|calculation_rows|\bfindExportFigures\b|\bfindFigureBasis\b/)).toEqual([]);
    const service = ALL.find((file) => file.path === EXPORT_SERVICE)?.text ?? '';
    expect(service).toMatch(/from '\.\.\/\.\.\/lib\/estimate\/figure-state'/);
    expect(service).toMatch(/readFiguresWhenCurrent\(\s*state,\s*\(\) => calculations\.findExportFigures\(/);
    expect(service.match(/findExportFigures\(/g)).toHaveLength(1);
  });

  it('the cost details service (STORY-06.03) imports the figure state and reads the working of a row only through readFiguresWhenCurrent, in one place', () => {
    const service = ALL.find((file) => file.path === COST_DETAILS_SERVICE)?.text ?? '';
    expect(service).toMatch(/from '\.\.\/\.\.\/lib\/estimate\/figure-state'/);
    expect(service).toMatch(/readFiguresWhenCurrent\(\s*state,\s*\(\) => calculations\.findRowWorking\(/);
    expect(service.match(/findRowWorking\(/g)).toHaveLength(1);
  });

  it('the review service imports the figure state and reads the record only through readFiguresWhenCurrent', () => {
    const service = ALL.find((file) => file.path === REVIEW_SERVICE)?.text ?? '';
    expect(service).toMatch(/from '\.\.\/\.\.\/lib\/estimate\/figure-state'/);
    expect(service).toMatch(/readFiguresWhenCurrent\(\s*state,\s*\(\) => calculations\.findReviewFigures\(/);
    // The one call of the read is the one inside the wrapper.
    expect(service.match(/findReviewFigures\(/g)).toHaveLength(1);
  });

  it('STORY-06.10 AC-6, STORY-07.06 AC-4 (NFR-002): the stored warnings of a calculation leave the repository by the reads of the figures, so only the review service and the export service (both for the Lead and the Admin) hold them; the name of who went ahead is named by no one else', () => {
    // `warnings` and `madeByName` are members of what `findReviewFigures` returns: the repository defines them and the review service passes them into the costs view, behind the Lead's and the Admin's roles.
    // STORY-07.06 AC-4 adds the export service, which passes them into SCR-10's summary behind the same two roles (the file never holds them: `export-service.test.ts` A-24).
    expect(pathsMatching(ALL, /\bmadeByName\b/).sort()).toEqual([REPOSITORY, REVIEW_SERVICE, EXPORT_SERVICE].sort());
    expect(pathsMatching(ALL, /\bfigures\.warnings\b/).sort()).toEqual([REVIEW_SERVICE, EXPORT_SERVICE].sort());
    // No Engineer route, page or component imports the review service or the costs view that carries the list.
    const engineerReachable = ALL.filter((file) => /^src\/app\/api\/v1\/estimates\/\[id\]\/(calculate|nodes)|^src\/components\/features\/estimate-workspace\//.test(file.path));
    expect(engineerReachable.length).toBeGreaterThan(10);
    expect(pathsMatching(engineerReachable, /estimate-review-service|getEstimateReviewService|schemas\/costs/)).toEqual([]);
  });

  it('control: a file that reads the figures with no figure-state is found by the scan', () => {
    const planted = [...ALL, { path: 'src/app/planted.tsx', text: 'const x = await calculations.findReviewFigures(id);' }];
    expect(pathsMatching(planted, READ_OF_FIGURES)).toContain('src/app/planted.tsx');
    expect(pathsMatching([{ path: 'src/server/planted.ts', text: 'db.calculationRow.findMany()' }], PRISMA_ACCESS)).toEqual(['src/server/planted.ts']);
  });
});

describe('AC-5: no review code reaches the Engineer', () => {
  const REVIEW_FOLDER = 'src/components/features/estimate-review/';
  const REVIEW_PAGE = 'src/app/(portal)/estimates/[code]/review-page.tsx';
  const RECALCULATE_BUTTON = 'src/components/features/estimate-recalculate/recalculate-button.tsx';
  const RECALCULATE_DIALOG = 'src/components/features/estimate-recalculate/recalculate-warning-dialog.tsx';
  const APPROVE_FOLDER = 'src/components/features/estimate-approve/';
  const APPROVE_BUTTON = `${APPROVE_FOLDER}approve-button.tsx`;
  const UNLOCK_FOLDER = 'src/components/features/estimate-unlock/';
  const UNLOCK_BUTTON = `${UNLOCK_FOLDER}unlock-button.tsx`;
  const CANCEL_FOLDER = 'src/components/features/estimate-cancel/';
  const CANCEL_BUTTON = `${CANCEL_FOLDER}cancel-button.tsx`;
  const REMOVE_FOLDER = 'src/components/features/estimate-remove-price/';
  const REMOVE_BUTTON = `${REMOVE_FOLDER}remove-button.tsx`;
  const PAGE = 'src/app/(portal)/estimates/[code]/page.tsx';
  const reviewFiles = ALL.filter((file) => file.path.startsWith(REVIEW_FOLDER));

  it('the review folder exists and none of its files is a client component, so none is ever sent to a browser as code', () => {
    expect(reviewFiles.length).toBeGreaterThanOrEqual(6);
    expect(reviewFiles.filter((file) => /^\s*['"]use client['"]/m.test(file.text)).map((file) => file.path)).toEqual([]);
    expect(reviewFiles.filter((file) => /\buse(State|Effect|Ref|Memo|Callback|Reducer|Transition)\b|\bnext\/dynamic\b|React\.lazy/.test(file.text)).map((file) => file.path)).toEqual([]);
  });

  it('the review folder imports no shared client component but the Recalculate button, the Approve button, the Unlock button and the Cancel approval button (a `use client` file would carry its chunk to the page, so each is accounted for: STORY-06.04, STORY-06.06, STORY-06.08, STORY-06.12, ADR-016)', () => {
    const clientFiles = new Set(ALL.filter((file) => /^\s*['"]use client['"]/m.test(file.text)).map((file) => file.path));
    // The three exceptions, named: the Calculate / Recalculate button, the Approve and lock button and the Unlock button. Each is imported by the action bar alone and loads its request code (or its dialog) only when first pressed (the next tests).
    clientFiles.delete(RECALCULATE_BUTTON);
    clientFiles.delete(APPROVE_BUTTON);
    clientFiles.delete(UNLOCK_BUTTON);
    clientFiles.delete(CANCEL_BUTTON);
    clientFiles.delete(REMOVE_BUTTON);
    const importsOf = (text: string): string[] => [...text.matchAll(/from '(@\/[^']+|\.{1,2}\/[^']+)'/g)].map((match) => match[1] ?? '');
    const resolve = (from: string, specifier: string): string[] => {
      const base = specifier.startsWith('@/') ? `src/${specifier.slice(2)}` : join(from, '..', specifier).replaceAll('\\', '/');
      return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
    };
    const reached = reviewFiles.flatMap((file) => importsOf(file.text).flatMap((specifier) => resolve(file.path, specifier)).filter((path) => clientFiles.has(path)));
    expect(reached).toEqual([]);
  });

  it('STORY-06.04 AC-7, ADR-016: the Recalculate button is the only client file of its folder, is a client component imported by the action bar alone, imports no figure, schema or service, and fetches its request code on the first press', () => {
    const folder = ALL.filter((file) => file.path.startsWith('src/components/features/estimate-recalculate/'));
    // The button, the Lead's quantity-warning dialog it fetches (STORY-06.10), and the one id the button shares with the action bar, in a file of its own (a server file cannot read a value out of a client file).
    expect(folder.map((file) => file.path).sort()).toEqual([RECALCULATE_BUTTON, 'src/components/features/estimate-recalculate/recalculate-ids.ts', RECALCULATE_DIALOG]);
    expect(folder.find((file) => file.path.endsWith('recalculate-ids.ts'))?.text ?? '').not.toMatch(/use client/);
    const button = folder.find((file) => file.path === RECALCULATE_BUTTON)?.text ?? '';
    expect(button).toMatch(/^\s*['"]use client['"]/m);
    const code = button.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    // No restricted module: not the costs schema, not the review, not a service or a repository, not the calculation's own code.
    expect(code).not.toMatch(/schemas\/|estimate-review|@\/server\/|calculation|row-outputs|product-totals|figure-state/);
    // The request code is a bare dynamic `import()`, not a static import: the page's first load does not carry it.
    expect(code).toMatch(/import\('@\/lib\/estimates\/recalculate-client'\)/);
    expect(code).not.toMatch(/^import .*recalculate-client/m);
    // STORY-06.10, ADR-016: the dialog is an overlay, so it is a bare dynamic import() behind a type-only import, like the request code and the Approve dialog; the button never imports it, nor the shared view it wraps.
    expect(code).toMatch(/import\('\.\/recalculate-warning-dialog'\)/);
    expect(code).toMatch(/^import type \{ RecalculateWarningDialogProps \} from '\.\/recalculate-warning-dialog';/m);
    expect(code).not.toMatch(/^import (?!type).*(recalculate-warning-dialog|quantity-warning-dialog)/m);
    // The dialog is a client component and holds no restricted module either: its words and rows are the server's sentences about a 0 that was typed, and no figure (NFR-002).
    const dialogFile = folder.find((file) => file.path === RECALCULATE_DIALOG)?.text ?? '';
    expect(dialogFile).toMatch(/^\s*['"]use client['"]/m);
    expect(dialogFile.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')).not.toMatch(/schemas\/|estimate-review|@\/server\/|calculation-|row-outputs|product-totals|figure-state/);
    // The action bar imports the button; the Approve button imports the one id of the "Calculated ..." line (`recalculate-ids.ts`, constants only) so that focus can go there after "Show the new figures".
    const importers = ALL.filter((file) => file.path !== RECALCULATE_BUTTON && /estimate-recalculate\//.test(file.text)).map((file) => file.path);
    expect(importers).toEqual([APPROVE_BUTTON, 'src/components/features/estimate-review/review-actions.tsx']);
    expect(ALL.filter((file) => file.path === APPROVE_BUTTON).every((file) => !/estimate-recalculate\/recalculate-button/.test(file.text))).toBe(true);
  });

  it('STORY-06.06 ADR-016: the Approve button and its dialog are the only client files of their folder, are imported by the review alone, import no figure, schema, service or repository, and the dialog is fetched on the first press', () => {
    const folder = ALL.filter((file) => file.path.startsWith(APPROVE_FOLDER));
    expect(folder.map((file) => file.path).sort()).toEqual([APPROVE_BUTTON, `${APPROVE_FOLDER}approve-dialog.tsx`, `${APPROVE_FOLDER}approve-ids.ts`, `${APPROVE_FOLDER}approve-texts.ts`]);
    for (const name of ['approve-ids.ts', 'approve-texts.ts']) expect(folder.find((file) => file.path.endsWith(name))?.text ?? '').not.toMatch(/use client/);
    const strip = (text: string): string => text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const button = strip(folder.find((file) => file.path === APPROVE_BUTTON)?.text ?? '');
    const dialog = strip(folder.find((file) => file.path.endsWith('approve-dialog.tsx'))?.text ?? '');
    expect(folder.find((file) => file.path === APPROVE_BUTTON)?.text ?? '').toMatch(/^\s*['"]use client['"]/m);
    expect(folder.find((file) => file.path.endsWith('approve-dialog.tsx'))?.text ?? '').toMatch(/^\s*['"]use client['"]/m);
    // No restricted module in either: not the costs schema, not the review, not a service, a repository or a calculation's own code.
    for (const code of [button, dialog]) expect(code).not.toMatch(/schemas\/|estimate-review|@\/server\/|calculation-|row-outputs|product-totals|figure-state/);
    // The dialog is a bare dynamic `import()` behind a type-only import, so the page's first load does not carry it; the words and the request code belong to the dialog.
    expect(button).toMatch(/import\('\.\/approve-dialog'\)/);
    expect(button).toMatch(/^import type \{ ApproveDialogProps \} from '\.\/approve-dialog';/m);
    expect(button).not.toMatch(/^import (?!type).*approve-(dialog|texts)/m);
    expect(button).not.toMatch(/approve-client/);
    expect(dialog).toMatch(/@\/lib\/estimates\/approve-client/);
    const importers = ALL.filter((file) => !file.path.startsWith(APPROVE_FOLDER) && /estimate-approve\//.test(file.text)).map((file) => file.path);
    expect(importers).toEqual(['src/components/features/estimate-review/estimate-review.tsx', 'src/components/features/estimate-review/review-actions.tsx']);
  });

  it('STORY-06.08 ADR-016: the Unlock button and its dialog are the only client files of their folder, are imported by the review alone, import no figure, schema, service or repository, and the dialog is fetched on the first press', () => {
    const folder = ALL.filter((file) => file.path.startsWith(UNLOCK_FOLDER));
    expect(folder.map((file) => file.path).sort()).toEqual([UNLOCK_BUTTON, `${UNLOCK_FOLDER}unlock-dialog.tsx`, `${UNLOCK_FOLDER}unlock-ids.ts`, `${UNLOCK_FOLDER}unlock-texts.ts`]);
    for (const name of ['unlock-ids.ts', 'unlock-texts.ts']) expect(folder.find((file) => file.path.endsWith(name))?.text ?? '').not.toMatch(/use client/);
    const strip = (text: string): string => text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const button = strip(folder.find((file) => file.path === UNLOCK_BUTTON)?.text ?? '');
    const dialog = strip(folder.find((file) => file.path.endsWith('unlock-dialog.tsx'))?.text ?? '');
    expect(folder.find((file) => file.path === UNLOCK_BUTTON)?.text ?? '').toMatch(/^\s*['"]use client['"]/m);
    expect(folder.find((file) => file.path.endsWith('unlock-dialog.tsx'))?.text ?? '').toMatch(/^\s*['"]use client['"]/m);
    // No restricted module in either: not the costs schema, not the review, not a service, a repository or a calculation's own code.
    for (const code of [button, dialog]) expect(code).not.toMatch(/schemas\/|estimate-review|@\/server\/|calculation-|row-outputs|product-totals|figure-state/);
    // The dialog is a bare dynamic `import()` behind a type-only import, so the page's first load does not carry it; the words and the request code belong to the dialog.
    expect(button).toMatch(/import\('\.\/unlock-dialog'\)/);
    expect(button).toMatch(/^import type \{ UnlockDialogProps \} from '\.\/unlock-dialog';/m);
    expect(button).not.toMatch(/^import (?!type).*unlock-(dialog|texts)/m);
    expect(button).not.toMatch(/unlock-client/);
    expect(dialog).toMatch(/@\/lib\/estimates\/unlock-client/);
    const importers = ALL.filter((file) => !file.path.startsWith(UNLOCK_FOLDER) && /estimate-unlock\//.test(file.text)).map((file) => file.path);
    expect(importers).toEqual(['src/components/features/estimate-review/review-actions.tsx', 'src/components/features/estimate-review/unlocked-notice.tsx']);
  });

  it('STORY-06.12 ADR-016: the Cancel approval button and its dialog are the only client files of their folder, are imported by the review alone, import no figure, schema, service or repository, and the dialog is fetched on the first press', () => {
    const folder = ALL.filter((file) => file.path.startsWith(CANCEL_FOLDER));
    expect(folder.map((file) => file.path).sort()).toEqual([CANCEL_BUTTON, `${CANCEL_FOLDER}cancel-dialog.tsx`, `${CANCEL_FOLDER}cancel-ids.ts`, `${CANCEL_FOLDER}cancel-texts.ts`]);
    for (const name of ['cancel-ids.ts', 'cancel-texts.ts']) expect(folder.find((file) => file.path.endsWith(name))?.text ?? '').not.toMatch(/use client/);
    const strip = (text: string): string => text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const button = strip(folder.find((file) => file.path === CANCEL_BUTTON)?.text ?? '');
    const dialog = strip(folder.find((file) => file.path.endsWith('cancel-dialog.tsx'))?.text ?? '');
    expect(folder.find((file) => file.path === CANCEL_BUTTON)?.text ?? '').toMatch(/^\s*['"]use client['"]/m);
    expect(folder.find((file) => file.path.endsWith('cancel-dialog.tsx'))?.text ?? '').toMatch(/^\s*['"]use client['"]/m);
    // No restricted module in either: not the costs schema, not the review, not a service, a repository or a calculation's own code.
    for (const code of [button, dialog]) expect(code).not.toMatch(/schemas\/|estimate-review|@\/server\/|calculation-|row-outputs|product-totals|figure-state/);
    // The dialog is a bare dynamic `import()` behind a type-only import, so the page's first load does not carry it; the words and the request code belong to the dialog.
    expect(button).toMatch(/import\('\.\/cancel-dialog'\)/);
    expect(button).toMatch(/^import type \{ CancelDialogProps \} from '\.\/cancel-dialog';/m);
    expect(button).not.toMatch(/^import (?!type).*cancel-(dialog|texts)/m);
    expect(button).not.toMatch(/cancel-approval-client/);
    expect(dialog).toMatch(/@\/lib\/estimates\/cancel-approval-client/);
    const importers = ALL.filter((file) => !file.path.startsWith(CANCEL_FOLDER) && /estimate-cancel\//.test(file.text)).map((file) => file.path);
    expect(importers).toEqual(['src/components/features/estimate-review/cancelled-notice.tsx', 'src/components/features/estimate-review/review-actions.tsx']);
  });

  it('STORY-06.13 ADR-016: the Remove price button and its dialog are the only client files of their folder, are imported by the review alone, import no figure, schema, service or repository, and the dialog is fetched on the first press', () => {
    const folder = ALL.filter((file) => file.path.startsWith(REMOVE_FOLDER));
    expect(folder.map((file) => file.path).sort()).toEqual([REMOVE_BUTTON, `${REMOVE_FOLDER}remove-dialog.tsx`, `${REMOVE_FOLDER}remove-ids.ts`, `${REMOVE_FOLDER}remove-texts.ts`]);
    for (const name of ['remove-ids.ts', 'remove-texts.ts']) expect(folder.find((file) => file.path.endsWith(name))?.text ?? '').not.toMatch(/use client/);
    const strip = (text: string): string => text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const button = strip(folder.find((file) => file.path === REMOVE_BUTTON)?.text ?? '');
    const dialog = strip(folder.find((file) => file.path.endsWith('remove-dialog.tsx'))?.text ?? '');
    expect(folder.find((file) => file.path === REMOVE_BUTTON)?.text ?? '').toMatch(/^\s*['"]use client['"]/m);
    expect(folder.find((file) => file.path.endsWith('remove-dialog.tsx'))?.text ?? '').toMatch(/^\s*['"]use client['"]/m);
    // No restricted module in either: not the costs schema, not the review, not a service, a repository or a calculation's own code.
    for (const code of [button, dialog]) expect(code).not.toMatch(/schemas\/|estimate-review|@\/server\/|calculation-|row-outputs|product-totals|figure-state/);
    // The dialog is a bare dynamic `import()` behind a type-only import, so the page's first load does not carry it; the words and the request code belong to the dialog.
    expect(button).toMatch(/import\('\.\/remove-dialog'\)/);
    expect(button).toMatch(/^import type \{ RemoveDialogProps \} from '\.\/remove-dialog';/m);
    expect(button).not.toMatch(/^import (?!type).*remove-(dialog|texts)/m);
    expect(button).not.toMatch(/remove-price-client/);
    expect(dialog).toMatch(/@\/lib\/estimates\/remove-price-client/);
    const importers = ALL.filter((file) => !file.path.startsWith(REMOVE_FOLDER) && /estimate-remove-price\//.test(file.text)).map((file) => file.path);
    expect(importers).toEqual(['src/components/features/estimate-review/price-removed-notice.tsx', 'src/components/features/estimate-review/review-actions.tsx']);
  });

  it('nothing outside the review imports a file of its folder except the review page', () => {
    const importers = ALL.filter((file) => !file.path.startsWith(REVIEW_FOLDER) && /estimate-review\//.test(file.text)).map((file) => file.path);
    expect(importers).toEqual([REVIEW_PAGE]);
  });

  it('the Engineer\'s page file imports no review code, no review service and no costs schema: it loads the review page with a dynamic import() on the Lead\'s and the Admin\'s branch', () => {
    const page = (ALL.find((file) => file.path === PAGE)?.text ?? '').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(page.length).toBeGreaterThan(100);
    expect(page).not.toMatch(/estimate-review|schemas\/costs|getEstimateReviewService/);
    const staticImports = [...page.matchAll(/^import .* from '([^']+)'/gm)].map((match) => match[1]);
    expect(staticImports.filter((specifier) => /review/i.test(specifier ?? ''))).toEqual([]);
    expect(page).toMatch(/await import\('\.\/review-page'\)/);
    // The dynamic import is after the Engineer's case has returned, and the roles are an allow-list closed by assertNever (review SQR-01): no role but the Lead and the Admin reaches it.
    expect(page.indexOf("await import('./review-page')")).toBeGreaterThan(page.indexOf("case 'ENGINEER':"));
    expect(page).toMatch(/case 'LEAD':\s*case 'ADMIN': \{[\s\S]*await import\('\.\/review-page'\)[\s\S]*\}\s*default:\s*return assertNever\(user\.role, 'role'\)/);
    expect(page).not.toMatch(/role !== 'ENGINEER'|role === 'ENGINEER'\)/);
  });

  it('control: a static import of the review in a page is found by the same scan', () => {
    const planted = "import { EstimateReview } from '@/components/features/estimate-review/estimate-review';";
    expect(planted).toMatch(/estimate-review/);
    expect([...planted.matchAll(/^import .* from '([^']+)'/gm)].map((match) => match[1]).filter((specifier) => /review/i.test(specifier ?? ''))).toHaveLength(1);
  });

  it('the Engineer\'s own feature folder imports nothing from the review and nothing of the calculation', () => {
    const workspace = ALL.filter((file) => file.path.startsWith('src/components/features/estimate-workspace/'));
    expect(workspace.length).toBeGreaterThan(5);
    expect(workspace.filter((file) => /estimate-review|schemas\/costs|calculation-repository|estimate-review-service|product-totals|row-outputs/.test(file.text)).map((file) => file.path)).toEqual([]);
  });
});
