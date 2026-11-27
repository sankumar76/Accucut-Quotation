import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ReviewTree } from '@/components/features/estimate-review/review-tree';
import { TOOLBAR_RESERVE, TOOLBAR_SLOT, TREE_FOOT } from '@/components/shared/tree-chrome';
import type { CostsView } from '@/server/views/schemas/costs';

import { defined } from '../support/defined';
import { createReviewWorld, REVIEW_ESTIMATE_ID } from '../support/review-world';

import { QUANTITY_CASES } from './quantity/quantity-cases';

/**
 * PF-18, PF-20 (DL-465 (3); ux ruling `partform-placeholder-shape-2026-11-28.md` section 9): the read-only tree of an estimate the Lead can correct reserves, in the first paint, the room of what the editing island
 * draws, from the same class strings (`tree-chrome.ts`): the toolbar line under each row (a mouse: the slot's own least height; a finger: a line under the selected row) and the foot with the room of "Add main
 * assembly". Every reserve is inert, hidden from assistive technology, with no name, id, role or control; a tree that cannot be edited reserves nothing. The pixels are judged in a browser
 * (`estimate-review-first-paint-move.spec.ts`). Every name is invented.
 */

const LEAD = { id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' } as const;
const CE1 = defined(QUANTITY_CASES.find((candidate) => candidate.id === 'CE-1'));
const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

async function tree(edit: boolean): Promise<{ readonly markup: string; readonly rows: number }> {
  const costs: CostsView = await createReviewWorld({ rows: CE1.rows, bl: CE1.bl }).service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
  const markup = renderToStaticMarkup(
    createElement(ReviewTree, { code: 'Q-2026-0318', state: costs.state, letters: costs.letters, nodes: costs.nodes, warned: new Set<string>(), selectedSlNo: defined(costs.nodes[0]).slNo, edit }),
  );
  return { markup, rows: costs.nodes.length };
}

describe('PF-20: the first paint of an editable tree reserves the island\'s room', () => {
  it('draws a toolbar reserve under every row and the foot\'s reserve, each inert and aria-hidden', async () => {
    const { markup, rows } = await tree(true);
    const reserves = markup.match(/<div[^>]*data-review-tree-reserve=""[^>]*>/g) ?? [];
    expect(reserves).toHaveLength(rows + 1);
    for (const reserve of reserves) {
      expect(reserve).toContain('inert=""');
      expect(reserve).toContain('aria-hidden="true"');
      expect(reserve).not.toMatch(/\b(id|role|tabindex|href)=/);
    }
    // The toolbar slot is the list's own, and the reserve inside it holds the finger's line under the selected row.
    expect(markup).toContain(TOOLBAR_SLOT);
    expect(markup).toContain(TOOLBAR_RESERVE);
  });

  it('holds the "Add main assembly" room with the real button classes, invisible, with no button, link or control in any reserve', async () => {
    const { markup } = await tree(true);
    const foot = defined(markup.match(new RegExp('<div class="' + TREE_FOOT + '">[\\s\\S]*$'))?.[0]);
    expect(foot).toContain('class="invisible"');
    expect(foot).toContain('Add main assembly');
    expect(foot).not.toContain('<button');
    expect(markup.match(/Add main assembly/g)).toHaveLength(1);
    expect(markup).not.toMatch(/<button[^>]*Add main assembly/);
  });

  it('reserves nothing when the tree cannot be edited', async () => {
    const { markup } = await tree(false);
    expect(markup).not.toContain('data-review-tree-reserve');
    expect(markup).not.toContain(TOOLBAR_RESERVE);
    expect(markup).not.toContain('Add main assembly');
    expect(markup).not.toContain(TREE_FOOT);
  });

  it('the reserve and the editing tree read the one set of class strings (tree-chrome.ts), so they cannot drift (PF-4 rule)', () => {
    expect(read('src/components/shared/parts-tree-list.tsx')).toContain("from '@/components/shared/tree-chrome'");
    expect(read('src/components/shared/parts-tree-list.tsx')).not.toMatch(/const TOOLBAR_SLOT = /);
    expect(read('src/components/features/estimate-workspace/tree-panel.tsx')).toMatch(/data-tree-foot="" className=\{TREE_FOOT\}/);
    expect(read('src/components/features/estimate-review/review-tree.tsx')).toMatch(/className=\{TREE_FOOT\}/);
    expect(read('src/components/shared/tree-chrome.ts')).not.toMatch(/^import /m);
  });
});
