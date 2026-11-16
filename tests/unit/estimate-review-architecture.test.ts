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

const READ_OF_FIGURES = /\b(findReviewFigures|findCalculation|findRowWorking)\b/;
const PRISMA_ACCESS = /\.(calculation|calculationRow)\./;
const REPOSITORY = 'src/server/repositories/calculation-repository.ts';
const REVIEW_SERVICE = 'src/server/services/estimate-review-service.ts';
const COST_DETAILS_SERVICE = 'src/server/services/cost-details-service.ts';

describe('AC-7: every read of a figure goes through figure-state', () => {
  it('only the calculation repository names the Prisma accessors of calculations and calculation_rows', () => {
    expect(pathsMatching(ALL, PRISMA_ACCESS)).toEqual([REPOSITORY]);
  });

  it('only the repository (which defines them), the review service and the cost details service name a method that reads a record\'s figures', () => {
    expect(pathsMatching(ALL, READ_OF_FIGURES).sort()).toEqual([REPOSITORY, REVIEW_SERVICE, COST_DETAILS_SERVICE].sort());
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
  const PAGE = 'src/app/(portal)/estimates/[code]/page.tsx';
  const reviewFiles = ALL.filter((file) => file.path.startsWith(REVIEW_FOLDER));

  it('the review folder exists and none of its files is a client component, so none is ever sent to a browser as code', () => {
    expect(reviewFiles.length).toBeGreaterThanOrEqual(6);
    expect(reviewFiles.filter((file) => /^\s*['"]use client['"]/m.test(file.text)).map((file) => file.path)).toEqual([]);
    expect(reviewFiles.filter((file) => /\buse(State|Effect|Ref|Memo|Callback|Reducer|Transition)\b|\bnext\/dynamic\b|React\.lazy/.test(file.text)).map((file) => file.path)).toEqual([]);
  });

  it('the review folder imports no shared client component but the one Recalculate button (a `use client` file would carry its chunk to the page, so each is accounted for: STORY-06.04, ADR-016)', () => {
    const clientFiles = new Set(ALL.filter((file) => /^\s*['"]use client['"]/m.test(file.text)).map((file) => file.path));
    // The one exception, named: the Calculate / Recalculate button. It is imported by the action bar alone, holds no figure, and loads its request code only when first pressed (the next test).
    clientFiles.delete(RECALCULATE_BUTTON);
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
    // The button, and the one id it shares with the action bar, in a file of its own (a server file cannot read a value out of a client file).
    expect(folder.map((file) => file.path).sort()).toEqual([RECALCULATE_BUTTON, 'src/components/features/estimate-recalculate/recalculate-ids.ts']);
    expect(folder.find((file) => file.path.endsWith('recalculate-ids.ts'))?.text ?? '').not.toMatch(/use client/);
    const button = folder.find((file) => file.path === RECALCULATE_BUTTON)?.text ?? '';
    expect(button).toMatch(/^\s*['"]use client['"]/m);
    const code = button.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    // No restricted module: not the costs schema, not the review, not a service or a repository, not the calculation's own code.
    expect(code).not.toMatch(/schemas\/|estimate-review|@\/server\/|calculation|row-outputs|product-totals|figure-state/);
    // The request code is a bare dynamic `import()`, not a static import: the page's first load does not carry it.
    expect(code).toMatch(/import\('@\/lib\/estimates\/recalculate-client'\)/);
    expect(code).not.toMatch(/^import .*recalculate-client/m);
    const importers = ALL.filter((file) => file.path !== RECALCULATE_BUTTON && /estimate-recalculate\//.test(file.text)).map((file) => file.path);
    expect(importers).toEqual(['src/components/features/estimate-review/review-actions.tsx']);
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
