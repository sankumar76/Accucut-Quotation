import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { TREE_CHANGING, TREE_CHANGING_ID } from '@/components/features/estimate-workspace/estimate-texts';
import { TreePanel, type TreePanelProps } from '@/components/features/estimate-workspace/tree-panel';
import type { PartsTreeState } from '@/components/features/estimate-workspace/use-parts-tree';
import { TREE_CALCULATING } from '@/components/features/estimate-review/review-texts';
import { TreeLegend } from '@/components/shared/tree-legend';
import type { NodeKind } from '@/lib/estimate/node-kinds';
import { ADD_MAIN_ASSEMBLY } from '@/lib/estimates/tree-actions';
import type { PartItem } from '@/lib/estimates/tree-client';

/**
 * DEF-131 stage 2T, the review's tree (UX ruling `lead-admin-edit-inputs-2026-11-27.md` 4.7 (a), (b); ED-18, ED-31, ED-33): the Engineer's `TreePanel` drawn with the review's own row and legends and no head. Each row of
 * the tree carries the move handle, the "+" (none on a Fastener) and the "-" on its own line under the row, "Add main assembly" is in the foot, and neither the resize handle nor the "Tree width" button is drawn. While a
 * change is on its way, or Recalculate is running, the buttons are `aria-disabled` and described by the line that says why. The island draws this panel only where `treeActionsOffered` says so; the panel itself draws no
 * action when it is not given `editable` (the Engineer's rule, unchanged). Every name is invented.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }), usePathname: () => '/estimates/Q-2026-0318' }));

const part = (id: string, parentId: string | null, slNo: string, nodeKind: NodeKind): PartItem => ({ id, parentId, slNo, label: `Name ${slNo}`, nodeKind, completeness: 'EMPTY', revision: 1 });
const NODES: ReadonlyArray<PartItem> = [part('m1', null, '1', 'MAIN_ASSEMBLY'), part('s1', 'm1', '1.1', 'SUB_ASSEMBLY'), part('p1', 's1', '1.1.1', 'PART'), part('f1', 'p1', '1.1.1.1', 'FASTENER')];

const noop = (): void => undefined;

function treeState(nodes: ReadonlyArray<PartItem> | null, over: Partial<PartsTreeState> = {}): PartsTreeState {
  return {
    nodes,
    loadFailed: false,
    fromSeed: false,
    selected: nodes?.[0] ?? null,
    selectedId: null,
    busy: false,
    waiting: false,
    movedFocus: null,
    ownMove: null,
    problem: null,
    announcement: '',
    announce: noop,
    deleting: null,
    deleteOpen: false,
    select: noop,
    addUnder: noop,
    wantsFocus: () => false,
    moveTo: noop,
    askDelete: noop,
    confirmDelete: () => Promise.resolve(),
    cancelDelete: noop,
    applySaved: noop,
    applyLabel: noop,
    readAgain: noop,
    ...over,
  };
}

const REVIEW_ROW = (node: PartItem): string => `REVIEW-ROW-${node.slNo}`;
const REVIEW_LEGENDS = createElement(TreeLegend);

const panel = (tree: PartsTreeState, editable: boolean, over: Partial<TreePanelProps> = {}): string =>
  renderToStaticMarkup(createElement(TreePanel, { tree, editable, review: { renderRow: REVIEW_ROW, legends: REVIEW_LEGENDS }, ...over }));

/** The names of the buttons of one row's toolbar, from its slot. */
function toolbarOf(html: string, id: string): string[] {
  const row = html.split(`data-part-row="${id}"`)[1] ?? '';
  // The row's own slot: up to the list of its children, which holds the rows below it.
  const slot = (row.split('<ul id="parts-tree-branch')[0] ?? '').split('data-row-toolbar=""')[1] ?? '';
  return [...slot.matchAll(/<button[^>]*aria-label="([^"]*)"/g)].map((match) => match[1] ?? '');
}

describe('ED-18: each row can show the move handle, the "+" and the "-" on its own line, and "Add main assembly" is in the foot', () => {
  const html = panel(treeState(NODES), true);

  it('draws the review\'s own row for every row of the tree, not the Engineer\'s', () => {
    for (const node of NODES) expect(html).toContain(REVIEW_ROW(node));
    expect(html).not.toContain('data-part-id=');
  });

  it('gives a Main Assembly, a Sub-Assembly and a Part the handle, the "+" and the "-", and a Fastener the handle and the "-" only', () => {
    expect(toolbarOf(html, 'm1')).toEqual(['Move 1 Name 1', 'Add under 1 Name 1', 'Delete 1 Name 1']);
    expect(toolbarOf(html, 's1')).toEqual(['Move 1.1 Name 1.1', 'Add under 1.1 Name 1.1', 'Delete 1.1 Name 1.1']);
    expect(toolbarOf(html, 'p1').map((name) => name.split(' ')[0])).toEqual(['Move', 'Add', 'Delete']);
    expect(toolbarOf(html, 'f1').map((name) => name.split(' ')[0])).toEqual(['Move', 'Delete']);
  });

  it('puts "Add main assembly" in the foot under a hairline, before the legend of the row kinds', () => {
    const foot = html.split('data-tree-foot=""')[1] ?? '';
    expect(foot).toContain(ADD_MAIN_ASSEMBLY);
    expect(foot.indexOf(ADD_MAIN_ASSEMBLY)).toBeLessThan(foot.indexOf('data-tree-legend'));
  });

  it('draws the legend of the row kinds and not the status legend of the Engineer\'s screen (completeness icons are not drawn on the review)', () => {
    expect(html).toContain('data-tree-legend');
    expect(html).not.toContain('Row status');
  });
});

describe('ED-33: no resize handle, no "Tree width" button, no head of its own', () => {
  const html = panel(treeState(NODES), true);
  it('draws none of them', () => {
    expect(html).not.toContain('Tree width');
    expect(html).not.toContain('data-tree-resize');
    expect(html).not.toContain('role="separator"');
    // The review's panel has its own title; the card head of the Engineer's tree ("Parts tree" with its row count) is not drawn.
    expect(html).not.toContain('4 rows');
  });
});

describe('ED-19: given no right to edit, the panel draws no action at all', () => {
  const html = panel(treeState(NODES), false);
  it('has no toolbar slot, no "Add main assembly" and no handle', () => {
    expect(html).not.toContain('data-row-toolbar');
    expect(html).not.toContain(ADD_MAIN_ASSEMBLY);
    expect(html).not.toContain('data-move-handle');
  });
});

describe('ED-31: while a change is on its way or Recalculate runs, the buttons wait and say why', () => {
  const disabled = (html: string): string[] => [...html.matchAll(/<button[^>]*aria-disabled="true"[^>]*>/g)].map((match) => match[0]);

  it('is available when nothing is going on: no button is aria-disabled and neither line is drawn', () => {
    const html = panel(treeState(NODES), true);
    expect(disabled(html)).toEqual([]);
    expect(html).not.toContain(TREE_CHANGING_ID);
  });

  it('while a change is on its way and has been for a moment: "Updating the parts. This takes a moment." describes the "+", the "-" and the handle', () => {
    const html = panel(treeState(NODES, { busy: true, waiting: true }), true);
    expect(html).toContain(TREE_CHANGING);
    const waiting = disabled(html);
    expect(waiting.length).toBeGreaterThanOrEqual(NODES.length);
    for (const button of waiting) expect(button).toContain(`aria-describedby="${TREE_CHANGING_ID}"`);
  });

  it('while Recalculate runs: "Calculating. This takes a moment." describes the same buttons, and the foot\'s "Add main assembly" too', () => {
    const html = panel(treeState(NODES), true, { calculating: TREE_CALCULATING });
    expect(html).toContain(TREE_CALCULATING);
    const waiting = disabled(html);
    expect(waiting.length).toBeGreaterThanOrEqual(NODES.length + 1);
    // The one line that says why the buttons wait carries the reason of the moment: its words are "Calculating" here and "Updating the parts" while a change is on its way.
    for (const button of waiting) expect(button).toContain(`aria-describedby="${TREE_CHANGING_ID}"`);
    expect(html).not.toContain(TREE_CHANGING);
    // A button that waits keeps its place and its name: the focus stays where it was.
    expect(toolbarOf(html, 's1')).toEqual(['Move 1.1 Name 1.1', 'Add under 1.1 Name 1.1', 'Delete 1.1 Name 1.1']);
  });

  it('the words are the ruling\'s', () => {
    expect(TREE_CALCULATING).toBe('Calculating. This takes a moment.');
    expect(TREE_CHANGING).toBe('Updating the parts. This takes a moment.');
  });
});

describe('ED-36: the tree is read before it is drawn, and a failed read says so', () => {
  it('draws a skeleton while the tree is being read and the notice with "Try again" when it could not be', () => {
    expect(panel(treeState(null), true)).toContain('role="status"');
    const failed = panel(treeState(null, { loadFailed: true }), true);
    expect(failed).toContain('Try again');
    expect(failed).not.toContain(ADD_MAIN_ASSEMBLY);
  });

  it('draws the empty line and "Add main assembly" for a tree with no rows, when editing is offered', () => {
    const html = panel(treeState([]), true);
    expect(html).toContain('No parts yet. Choose &quot;Add main assembly&quot; to add the first one.');
    expect(html).toContain(ADD_MAIN_ASSEMBLY);
  });
});
