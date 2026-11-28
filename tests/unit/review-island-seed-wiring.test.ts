import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * DEF-141 step 2 (DL-455, the architect's note v1.1): the Lead's editing island starts from what the page read and reads none of it again. The page's seed reaches the island through the thin shell; the island hands
 * it to the tree hook (the tree) and to the form (the definition, the materials, the part's values and the treatments), so the island makes no second `/form`, `/options/*`, `/nodes/<id>` or `/tree` read of its own.
 * The behaviour is in `part-form-seeded-reads.test.ts` and `part-form-seed.test.ts`; this keeps the wiring from being cut by an edit that still compiles.
 */

const read = (path: string): string => readFileSync(path, 'utf8');
const ISLAND = read('src/components/features/estimate-review-edit/review-tree-editor.tsx');
const SHELL = read('src/components/features/estimate-review-edit/review-edit-shell.tsx');
const REVIEW = read('src/components/features/estimate-review/estimate-review.tsx');
const PAGE = read('src/app/(portal)/estimates/[code]/review-page.tsx');

describe('the island and the seed', () => {
  it('the island gives the seed to the tree hook and to its form', () => {
    expect(ISLAND).toMatch(/usePartsTree\(estimateId, refresh, \{[^}]*\bseed\b[^}]*\}\)/);
    expect(ISLAND).toMatch(/<ReviewForm[\s\S]*?\bseed=\{formSeed\}/);
  });

  it('DL-470 (3): the form gets the page seed only until another row is shown; the first row opened again is read from the server, never from the snapshot', () => {
    // The seed is the first row's data as drawn; once any other row is shown it is dropped for good (state, set during the render), so the first row form, mounted again, starts from the server.
    expect(ISLAND).toMatch(/const \[seedKept, setSeedKept\] = useState\(true\)/);
    expect(ISLAND).toMatch(/if \(seedKept && firstSeed !== undefined && shown !== null && shown\.id !== firstSeed\.partId\) setSeedKept\(false\)/);
    expect(ISLAND).toMatch(/const formSeed = seedKept \? firstSeed : undefined/);
    // A page drawn again hands a new seed; the island keeps the first one (state), so a row chosen through the address never feeds the form a snapshot taken at that moment.
    expect(ISLAND).toMatch(/const \[firstSeed\] = useState\(seed\)/);
    expect(ISLAND).toMatch(/seed: firstSeed/);
    // The tree hook starts from the page's tree once and reads its seed at mount only (use-parts-tree.ts), so the same rule needs nothing there.
  });

  it('DL-470 (3), DL-465: a row named by the address (a link the leave guard took, Back) is opened by the island as a press on it would', () => {
    // After a save the leave guard holds the click and navigates with the router, so the row link's own handler never runs: the island follows the address instead.
    expect(ISLAND).toMatch(/const rowParam = useSearchParams\(\)\.get\('row'\)/);
    expect(ISLAND).toMatch(/if \(rowParam !== seenRow\) \{[\s\S]*?choose\(named\.id\)/);
  });

  it('DEF-145, DL-465: the page draws ONE ghost on the server, for the page\'s own editable; the first paint\'s form and the island\'s form both get it, so the swap moves nothing', () => {
    expect(REVIEW).toMatch(/const ghost = seed === undefined \? undefined : ghostOf\(\{[^}]*head: 'lead', editable \}\)/);
    expect(REVIEW.match(/ghostOf\(/g)).toHaveLength(1);
    expect(REVIEW).toMatch(/<ReviewEditShell[\s\S]*?\bghost=\{ghost\}[\s\S]*?>/);
    expect(REVIEW).toMatch(/<PartForm[\s\S]*?\bghost=\{ghost\}/);
    expect(ISLAND).toMatch(/<ReviewForm[\s\S]*?\bghost=\{ghost\}/);
  });

  it('the island takes the form\'s revision from the tree row it shows, not from a placeholder', () => {
    expect(ISLAND).toMatch(/part=\{\{ id: shown\.id, slNo: shown\.slNo, revision: shown\.revision \}\}/);
  });

  it('the shell passes every prop of the island on, the seed included', () => {
    expect(SHELL).toMatch(/\.\.\.island/);
    expect(REVIEW).toMatch(/<ReviewEditShell[\s\S]*?\bseed=\{seed\}[\s\S]*?>/);
  });

  it('the server-drawn read-only form gets the same seed, so it reads nothing either', () => {
    expect(REVIEW).toMatch(/<PartForm[\s\S]*?\bseed=\{seed\}/);
  });

  it('the page asks for the tree in the seed only where the island is drawn', () => {
    expect(PAGE).toMatch(/treeActionsOffered\(\{ status: header\.status, ignored: ignored !== null \}, viewer\.role\)/);
  });
});
