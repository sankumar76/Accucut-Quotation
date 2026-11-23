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
    waiting: false,
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

const panel = (nodes: ReadonlyArray<PartItem> | null, editable: boolean, state: Partial<PartsTreeState> = {}): string => renderToStaticMarkup(createElement(TreePanel, { tree: { ...treeState(nodes), ...state }, editable }));

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

/** The opening tag of the button with this name: its `aria-label`, or its words when it has none. */
const buttonTag = (html: string, name: string): string => {
  for (const button of html.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? []) {
    const tag = button.match(/^<button[^>]*>/)?.[0] ?? '';
    if (tag.includes(`aria-label="${name}"`) || button.replace(/<[^>]+>/g, '') === name) return tag;
  }
  throw new Error(`no button named ${name}`);
};
/** The attribute `disabled` itself, not the `disabled:` classes. */
const DISABLED = / disabled=""/;

describe('AQP-343 (DEF-040, DL-340): the tree while a change is on its way', () => {
  const WORDS = 'Updating the parts. This takes a moment.';
  const waiting = { busy: true, waiting: true } as const;

  it('shows the line above the tree once the wait is long enough, as plain text and not a live region, and in the empty tree too', () => {
    for (const nodes of [NODES, []]) {
      const html = panel(nodes, true, waiting);
      expect(count(html, WORDS)).toBe(1);
      expect(html).toContain(`<p id="parts-tree-changing" class="text-body text-ink-2">${WORDS}</p>`);
      expect(html.indexOf(WORDS)).toBeLessThan(html.indexOf('aria-label="Parts tree"') === -1 ? html.length : html.indexOf('aria-label="Parts tree"'));
    }
    // The live line is the one that was always there, and it holds the usual announcement; the screen reader hears the same words from it (the hook sets both).
    expect(panel(NODES, true, { ...waiting, announcement: WORDS })).toContain(`<p role="status" class="sr-only">${WORDS}</p>`);
  });

  it('keeps the move buttons, "Add main assembly" and the row buttons aria-disabled and described by that line, and none of them is disabled', () => {
    const html = panel(NODES, true, waiting);
    for (const name of ['Move up', 'Move down', 'Add main assembly', 'Add under 1 Hopper', 'Add fastener under 1.1.1 Plate', 'Delete 1 Hopper', 'Delete 1.1.1.1 Nut']) {
      const tag = buttonTag(html, name);
      expect(tag, name).toContain('aria-disabled="true"');
      expect(tag, name).toContain('aria-describedby="parts-tree-changing"');
      expect(tag, name).not.toMatch(DISABLED);
    }
    expect(html).toContain('>Move up<');
  });

  it('is aria-disabled for the first 300 ms too, but names no line that is not on screen yet', () => {
    const html = panel(NODES, true, { busy: true });
    expect(html).not.toContain('parts-tree-changing');
    expect(buttonTag(html, 'Move down')).toContain('aria-disabled="true"');
    expect(buttonTag(html, 'Move down')).not.toContain('aria-describedby');
    expect(buttonTag(html, 'Add main assembly')).toContain('aria-disabled="true"');
  });

  it('is as it was when nothing is on its way: no line, no description, "Add main assembly" enabled', () => {
    const html = panel(NODES, true);
    expect(html).not.toContain('parts-tree-changing');
    expect(html).not.toContain(WORDS);
    expect(buttonTag(html, 'Add main assembly')).not.toContain('aria-disabled');
    expect(buttonTag(html, 'Add main assembly')).not.toMatch(DISABLED);
  });

  it('puts "We could not load the parts" with "Try again" in the place of a tree that could not be read again, with no move buttons and no claim about the change', () => {
    const html = panel(NODES, true, { problem: { kind: 'unconfirmed' } });
    expect(html).toContain('We could not load the parts');
    expect(html).toContain('Check your connection and try again. What you typed is kept.');
    expect(html).toContain('>Try again<');
    expect(html).not.toContain('data-part-id=');
    expect(html).not.toContain('>Move up<');
    expect(html).not.toContain('The change was not made');
    expect(html).not.toContain('was saved');
  });

  it('keeps the words of the Notices that were there: not made, and changed by someone else', () => {
    expect(panel(NODES, true, { problem: { kind: 'failed' } })).toContain('The change was not made');
    expect(panel(NODES, true, { problem: { kind: 'changed' } })).toContain('The parts were changed by someone else. The tree has been refreshed. Check it and try again.');
  });
});
