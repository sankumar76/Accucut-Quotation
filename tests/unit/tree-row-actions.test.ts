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
const actions = (node: PartItem): string => renderToStaticMarkup(createElement(RowActions, { part: node, onAdd: noop, onDelete: noop, upTo: 0, downTo: 1, onMoveTo: noop }));
const count = (html: string, text: string): number => html.split(text).length - 1;

function treeState(nodes: ReadonlyArray<PartItem> | null): PartsTreeState {
  return {
    nodes,
    loadFailed: false,
    selected: nodes?.[0] ?? null,
    busy: false,
    waiting: false,
    movedFocus: null,
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
    readAgain: noop,
  };
}

const panel = (nodes: ReadonlyArray<PartItem> | null, editable: boolean, state: Partial<PartsTreeState> = {}): string => renderToStaticMarkup(createElement(TreePanel, { tree: { ...treeState(nodes), ...state }, editable }));

describe('RowActions: the move handle of a row (AQP-406 AC-2, AC-5)', () => {
  it('has a move handle on every row, named after its row, first in the toolbar and before the "+" and the "-"', () => {
    for (const node of NODES) {
      const html = actions(node);
      expect(html).toContain(`aria-label="Move ${node.slNo} ${node.label}"`);
      expect(html).toContain('aria-haspopup="menu"');
      expect(html.indexOf('aria-label="Move ')).toBeLessThan(html.indexOf('aria-label="Delete '));
    }
    expect(actions(NODES[2] as PartItem).indexOf('aria-label="Move ')).toBeLessThan(actions(NODES[2] as PartItem).indexOf('aria-label="Add fastener'));
  });

  it('is a touch target of the same size as the other row buttons, and does not scroll the page when a finger goes down on it', () => {
    const html = actions(NODES[0] as PartItem);
    const handle = html.match(/<button[^>]*aria-label="Move [^"]*"[^>]*>/)?.[0] ?? '';
    expect(handle).toContain('h-(--control-h)');
    expect(handle).toContain('fine-wide:h-(--control-h-row)');
    expect(handle).toContain('touch-none');
  });
});

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
    // The "+" is a plain button; the move handle beside it is the menu button.
    expect(html.match(/<button[^>]*aria-label="Add fastener under[^"]*"[^>]*>/)?.[0]).not.toContain('aria-haspopup');
  });

  it('has no "+" on a Fastener', () => {
    const html = actions(NODES[3] as PartItem);
    expect(html).not.toContain('Add under');
    expect(html).not.toContain('Add fastener');
    // The move handle and the "-": no "+".
    expect(count(html, '<button')).toBe(2);
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

/** The class tokens of the opening tag that carries this attribute. */
const classesOf = (html: string, marker: string): string[] => {
  const tag = html.match(new RegExp(`<[^>]*${marker}[^>]*>`))?.[0] ?? '';
  return (tag.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter((token) => token !== '');
};
const group = (html: string): string[] => classesOf(html, 'data-row-actions');
/** The class tokens of the group of one row of the panel. */
const groupTokens = (html: string, node: PartItem): string[] => classesOf(html, 'aria-label="Actions for ' + node.slNo + ' ' + node.label + '"');

describe('AQP-418 (DEF-075): the toolbar of a row never floats over the row', () => {
  it('is one group named after its row ("Actions for <number> <name>"), and names a row with no name "Part"', () => {
    for (const node of NODES) {
      const html = actions(node);
      expect(html).toContain('role="group"');
      expect(html).toContain(`aria-label="Actions for ${node.slNo} ${node.label}"`);
    }
    expect(actions(part('x', null, '3', 'MAIN_ASSEMBLY'))).toContain('aria-label="Actions for 3 Part"');
  });

  it('is clipped (sr-only) until the row is shown, never by opacity, display or visibility, and has no hover or touch variant', () => {
    const classes = group(actions(NODES[1] as PartItem));
    expect(classes).toContain('sr-only');
    for (const token of classes) {
      expect(token, token).not.toMatch(/opacity|invisible|pointer-coarse|hover|(^|:)hidden$|(^|:)collapse$/);
    }
    const html = actions(NODES[1] as PartItem);
    expect(html).not.toContain('opacity-0');
    expect(html).not.toContain('pointer-coarse');
    expect(html).not.toContain('group-hover');
  });

  it('is shown by the open row, by focus that is visible in the row, and by a menu of the row that is open', () => {
    const classes = group(actions(NODES[1] as PartItem));
    expect(classes).toContain('group-has-[[aria-current=true]]/row:not-sr-only');
    expect(classes).toContain('group-has-[:focus-visible]/row:not-sr-only');
    // The branch arrows carry aria-expanded too: only a button that opens a menu (the move handle, the "+") keeps the toolbar shown.
    expect(classes).toContain('group-has-[[aria-haspopup][aria-expanded=true]]/row:not-sr-only');
    expect(classes.filter((token) => token.includes('aria-expanded') && !token.includes('aria-haspopup'))).toEqual([]);
  });

  it('is shown at once while the delete confirmation of this row is open (showing), and not otherwise', () => {
    const shown = renderToStaticMarkup(createElement(RowActions, { part: NODES[2] as PartItem, onAdd: noop, onDelete: noop, upTo: 0, downTo: 1, onMoveTo: noop, showing: true }));
    expect(group(shown)).toContain('not-sr-only');
    expect(group(shown)).not.toContain('sr-only');
    expect(group(actions(NODES[2] as PartItem))).not.toContain('not-sr-only');
  });

  it('never reads busy: the same classes with a change on its way, so nothing is clipped, moved or unmounted under a focused button (AQP-343)', () => {
    const busy = renderToStaticMarkup(createElement(RowActions, { part: NODES[2] as PartItem, onAdd: noop, onDelete: noop, upTo: 0, downTo: 1, onMoveTo: noop, busy: true }));
    expect(group(busy)).toEqual(group(actions(NODES[2] as PartItem)));
    expect(busy).toContain('aria-label="Delete 1.1.1 Plate"');
  });

  it('keeps the order move, "+", "-" inside the group, with the group first, so the focus order is unchanged', () => {
    const html = actions(NODES[2] as PartItem);
    expect(html.indexOf('role="group"')).toBeLessThan(html.indexOf('aria-label="Move '));
    expect(html.indexOf('aria-label="Move ')).toBeLessThan(html.indexOf('aria-label="Add fastener'));
    expect(html.indexOf('aria-label="Add fastener')).toBeLessThan(html.indexOf('aria-label="Delete '));
  });
});

describe('AQP-418 (DEF-075): the toolbar slot of a row in the panel', () => {
  it('is under the name: one slot per row after its link, and the open row is the only one the panel marks open', () => {
    const html = panel(NODES, true);
    expect(count(html, 'data-row-toolbar=""')).toBe(NODES.length);
    for (const node of NODES) {
      const row = html.slice(html.indexOf(`data-part-id="${node.id}"`));
      expect(row.indexOf('data-row-toolbar')).toBeGreaterThan(row.indexOf('</a>'));
    }
  });

  it('passes showing to the row whose delete confirmation is open and to no other', () => {
    const target = { id: 'p1', slNo: '1.1.1', revision: 1, parentId: 's1', parts: 2, subtree: 'x', removedIds: [] };
    const standing = (html: string): string[] => NODES.filter((node) => groupTokens(html, node).includes('not-sr-only')).map((node) => node.slNo);
    expect(standing(panel(NODES, true, { deleting: target, deleteOpen: true }))).toEqual(['1.1.1']);
    expect(standing(panel(NODES, true, { deleting: target, deleteOpen: false }))).toEqual([]);
    expect(standing(panel(NODES, true))).toEqual([]);
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

  it('has lost the Add, Sub-part, Part beside, Delete, Move up and Move down buttons that sat above the input sections: moving is the handle of each row (3D)', () => {
    const html = panel(NODES, true);
    for (const gone of ['>New item<', '>Sub-part<', '>Part beside<', '>Delete<', '>Move up<', '>Move down<']) expect(html, gone).not.toContain(gone);
    expect(count(html, 'aria-label="Move ')).toBe(NODES.length);
  });

  it('offers nothing where the person may not change the inputs: no "+", no "-", no "Add main assembly", no Move buttons, and the tree and its legend are still drawn', () => {
    const html = panel(NODES, false);
    for (const gone of ['data-row-actions', 'Add main assembly', 'aria-label="Delete ', 'aria-label="Add', 'aria-label="Move ', '>Move up<', '>Move down<']) expect(html, gone).not.toContain(gone);
    expect(count(html, 'data-part-id=')).toBe(NODES.length);
    expect(html).toContain('data-tree-legend');
    // AQP-418 (DEF-075): no toolbar slot at all, so there is no empty line and no change of the row's height (acceptance check 9).
    expect(html).not.toContain('data-row-toolbar');
    expect(html).not.toContain('role="group"');
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
    for (const name of ['Move 1 Hopper', 'Move 1.1 Frame', 'Add main assembly', 'Add under 1 Hopper', 'Add fastener under 1.1.1 Plate', 'Delete 1 Hopper', 'Delete 1.1.1.1 Nut']) {
      const tag = buttonTag(html, name);
      expect(tag, name).toContain('aria-disabled="true"');
      expect(tag, name).toContain('aria-describedby="parts-tree-changing"');
      expect(tag, name).not.toMatch(DISABLED);
    }
    expect(html).toContain('aria-label="Move 1 Hopper"');
  });

  it('is aria-disabled for the first 300 ms too, but names no line that is not on screen yet', () => {
    const html = panel(NODES, true, { busy: true });
    expect(html).not.toContain('parts-tree-changing');
    expect(buttonTag(html, 'Move 1.1 Frame')).toContain('aria-disabled="true"');
    expect(buttonTag(html, 'Move 1.1 Frame')).not.toContain('aria-describedby');
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
    expect(html).not.toContain('aria-label="Move ');
    expect(html).not.toContain('The change was not made');
    expect(html).not.toContain('was saved');
  });

  it('keeps the words of the Notices that were there: not made, and changed by someone else', () => {
    expect(panel(NODES, true, { problem: { kind: 'failed' } })).toContain('The change was not made');
    expect(panel(NODES, true, { problem: { kind: 'changed' } })).toContain('The parts were changed by someone else. The tree has been refreshed. Check it and try again.');
  });
});

describe('AQP-406 PRF-C-01 (#665): the panel draws every row\'s toolbar in a number of reads that grows with the rows, not with their square', () => {
  /** Nodes whose `id`, `parentId` and `nodeKind` count how often they are read. A scan of the whole list for each row would read each of them 1,000 times. */
  function countedTree(size: number, parentOf: (index: number) => string | null): { readonly nodes: PartItem[]; readonly reads: () => number } {
    let reads = 0;
    const nodes = Array.from({ length: size }, (_, index): PartItem => {
      const id = `n${String(index)}`;
      const parentId = parentOf(index);
      const nodeKind: NodeKind = index === 0 ? 'MAIN_ASSEMBLY' : 'PART';
      return Object.defineProperties(part(id, parentId, id, nodeKind), {
        id: { get: () => ((reads += 1), id), enumerable: true },
        parentId: { get: () => ((reads += 1), parentId), enumerable: true },
        nodeKind: { get: () => ((reads += 1), nodeKind), enumerable: true },
      });
    });
    return { nodes, reads: () => reads };
  }

  const SHAPES: Record<string, (index: number) => string | null> = {
    'one parent with 999 parts': (index) => (index === 0 ? null : 'n0'),
    'a legacy chain 150 deep with 850 parts at its foot': (index) => (index === 0 ? null : `n${String(Math.min(index, 150) - 1)}`),
    '30 groups of 32 parts under one assembly': (index) => (index === 0 ? null : index <= 30 ? 'n0' : `n${String(1 + ((index - 31) % 30))}`),
  };

  it.each(Object.entries(SHAPES))('%s: 1,000 rows, a fixed number of reads for each row', (_name, parentOf) => {
    const { nodes, reads } = countedTree(1000, parentOf);
    const before = reads();
    const html = panel(nodes, true);
    expect(count(html, 'data-row-actions')).toBe(1000);
    // Each row is read by its place, its kind name, its link and its toolbar. A full scan for Move up and another for Move down would be 2 x 1,000 x 1,000 reads at least.
    expect(reads() - before).toBeLessThanOrEqual(1000 * 40);
  }, 30_000);
});
