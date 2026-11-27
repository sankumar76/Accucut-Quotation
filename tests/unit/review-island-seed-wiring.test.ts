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
    expect(ISLAND).toMatch(/<ReviewForm[\s\S]*?\bseed=\{seed\}/);
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
