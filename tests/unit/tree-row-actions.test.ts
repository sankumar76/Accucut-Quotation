import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RowActions } from '@/components/features/estimate-workspace/row-actions';
import { TreePanel } from '@/components/features/estimate-workspace/tree-panel';
import type { PartsTreeState } from '@/components/features/estimate-workspace/use-parts-tree';
import type { NodeKind } from '@/lib/estimate/node-kinds';
import type { PartItem } from '@/lib/estimates/tree-client';

/**
 * AQP-405 (CR-01 item 3C; UX spec section 0.9 row 3; SPEC 14.30, 14.33, 14.35): what the row actions draw, rendered to markup with no browser. The "+" of a row (a menu, or the Fastener at once, or nothing), the
 * "-" of every row, "Add main assembly" at the foot, the old Add and Delete buttons gone, and nothing at all where the person may not change the inputs. The behaviour in a browser (the menu, the dialog, the
 * focus, axe, the widths) is `tests/e2e/estimate-tree.spec.ts`; the rule of who is offered what is `tests/unit/tree-actions.test.ts`. Every ID and name is invented.
 */

const part = (id: string, parentId: string | null, slNo: string, nodeKind: NodeKind, label = ''): PartItem => ({ id, parentId, slNo, label, nodeKind, completeness: 'EMPTY', revision: 1 });

const NODES: ReadonlyArray<PartItem> = [
  part('m1', null, '1', 'MAIN_ASSEMBLY', 'Hopper'),
  part('s1', 'm1', '1.1', 'SUB_ASSEMBLY', 'Frame'),
  part('p1', 's1', '1.1.1', 'PART', 'Plate'),
  part('f1', 'p1', '1.1.1.1', 'FASTENER', 'Nut'),
];

const noop = (): void => undefined;
const actions = (node: PartItem): string => renderToStaticMarkup(createElement(RowActions, { part: node, onAdd: noop, onDelete: noop }));
const count = (html: string, text: string): number => html.split(text).length - 1;

function treeState(nodes: ReadonlyArray<PartItem> | null): PartsTreeState {
  return {
    nodes,
    loadFailed: false,
    selected: nodes?.[0] ?? null,
    busy: false,
    problem: null,
    announcement: '',
    deleting: null,
    deleteOpen: false,
    select: noop,
    addUnder: noop,
    wantsFocus: () => false,
    move: noop,
    askDelete: noop,
    confirmDelete: () => Promise.resolve(),
    cancelDelete: noop,
    applySaved: noop,
    readAgain: noop,
  };
}

const panel = (nodes: ReadonlyArray<PartItem> | null, editable: boolean): string => renderToStaticMarkup(createElement(TreePanel, { tree: treeState(nodes), editable }));

describe('RowActions: the "+" of a row (AC-1, AC-2, 14.30)', () => {
  it('is a menu button under a Main Assembly and under a Sub-Assembly, named after its row', () => {
    const main = actions(NODES[0] as PartItem);
    expect(main).toContain('aria-label="Add under 1 Hopper"');
    expect(main).toContain('title="Add under 1 Hopper"');
    expect(main).toContain('aria-haspopup="menu"');
    expect(main).toContain('aria-expanded="false"');
    const sub = actions(NODES[1] as PartItem);
    expect(sub).toContain('aria-label="Add under 1.1 Frame"');
    expect(sub).toContain('aria-haspopup="menu"');
  });

  it('adds the Fastener at once under a Part, with no menu: "Add fastener under <row>" is its tooltip and its spoken name', () => {
    const html = actions(NODES[2] as PartItem);
    expect(html).toContain('aria-label="Add fastener under 1.1.1 Plate"');
    expect(html).toContain('title="Add fastener under 1.1.1 Plate"');
    expect(html).not.toContain('aria-haspopup');
  });

  it('has no "+" on a Fastener', () => {
    const html = actions(NODES[3] as PartItem);
    expect(html).not.toContain('Add under');
    expect(html).not.toContain('Add fastener');
    expect(count(html, '<button')).toBe(1);
  });

  it('puts a "-" on every row, named after its row (AC-4)', () => {
    for (const node of NODES) expect(actions(node)).toContain(`aria-label="Delete ${node.slNo} ${node.label}"`);
  });

  it('uses the 44 px square, and 36 px from 1024 px with a fine pointer, and names a row with no name "Part"', () => {
    const html = actions(part('x', null, '3', 'MAIN_ASSEMBLY'));
    expect(html).toContain('h-(--control-h)');
    expect(html).toContain('fine-wide:h-(--control-h-row)');
    expect(html).toContain('aria-label="Delete 3 Part"');
  });
});

describe('TreePanel: where the actions are (AC-3, AC-5, AC-6)', () => {
  it('puts "Add main assembly" at the foot of the tree, before the legend, and a "+" and a "-" on each row', () => {
    const html = panel(NODES, true);
    expect(html).toContain('Add main assembly');
    expect(html.indexOf('</nav>')).toBeLessThan(html.indexOf('Add main assembly'));
    expect(html.indexOf('Add main assembly')).toBeLessThan(html.indexOf('data-tree-legend'));
    expect(count(html, 'data-row-actions=""')).toBe(NODES.length);
    expect(count(html, 'aria-label="Delete ')).toBe(NODES.length);
  });

  it('has lost the Add, Sub-part, Part beside and Delete buttons that sat above the input sections, and keeps Move up and Move down until 3D', () => {
    const html = panel(NODES, true);
    for (const gone of ['>New item<', '>Sub-part<', '>Part beside<', '>Delete<']) expect(html, gone).not.toContain(gone);
    expect(html).toContain('>Move up<');
    expect(html).toContain('>Move down<');
  });

  it('offers nothing where the person may not change the inputs: no "+", no "-", no "Add main assembly", no Move buttons, and the tree and its legend are still drawn', () => {
    const html = panel(NODES, false);
    for (const gone of ['data-row-actions', 'Add main assembly', 'aria-label="Delete ', 'aria-label="Add', '>Move up<', '>Move down<']) expect(html, gone).not.toContain(gone);
    expect(count(html, 'data-part-id=')).toBe(NODES.length);
    expect(html).toContain('data-tree-legend');
    // The slot is still there, empty, so a later story does not lay the row out again.
    expect(count(html, 'data-row-toolbar=""')).toBe(NODES.length);
  });

  it('shows "Add main assembly" in an empty tree, in words that name it, and not to a person who may not edit', () => {
    const empty = panel([], true);
    expect(empty).toContain('No parts yet. Choose &quot;Add main assembly&quot; to add the first one.');
    expect(count(empty, '>Add main assembly<')).toBe(1);
    expect(panel([], false)).not.toContain('>Add main assembly<');
  });

  it('shows nothing of the actions while the tree is still being read', () => {
    const html = panel(null, true);
    expect(html).not.toContain('Add main assembly');
    expect(html).not.toContain('data-row-actions');
  });
});
