import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { EstimateWorkspace } from '@/components/features/estimate-workspace/estimate-workspace';
import { RowActions } from '@/components/features/estimate-workspace/row-actions';
import { TreePanel } from '@/components/features/estimate-workspace/tree-panel';
import type { PartsTreeState } from '@/components/features/estimate-workspace/use-parts-tree';
import { PartsTreeList } from '@/components/shared/parts-tree-list';
import { TreeLegend } from '@/components/shared/tree-legend';
import type { NodeKind } from '@/lib/estimate/node-kinds';
import type { PartItem } from '@/lib/estimates/tree-client';

import { blocksOf, customProperties } from '../support/css-tokens';

/**
 * DEF-081 (AQP-424; UX ruling `docs/03-ux/rulings/parts-tree-vs-scr05-2026-11-24.md`, items 9 to 14; delivery lead's decisions of 2026-11-24): the parts tree sits in a card of its own, headed "Parts tree" with its
 * row count, 320 px wide; a mouse at 1024 px and wider gets the 24 x 36 arrow and a 20 px step, a finger keeps 44 px (NFR-017); the row toolbar is quiet at rest; "Add main assembly" is a ghost button under a
 * hairline; the legends have no visible title and the status legend is there. Styling only: a class or a token is the contract, so these read the classes in the rendered markup. Every ID and name is invented.
 */

// The workspace reads the router and the path; a static render has neither, and what is drawn does not use them.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }), usePathname: () => '/estimates/Q-2026-0318' }));

const part = (id: string, parentId: string | null, slNo: string, nodeKind: NodeKind, completeness: PartItem['completeness'] = 'EMPTY'): PartItem => ({ id, parentId, slNo, label: `Name ${slNo}`, nodeKind, completeness, revision: 1 });

const NODES: ReadonlyArray<PartItem> = [part('m1', null, '1', 'MAIN_ASSEMBLY'), part('s1', 'm1', '1.1', 'SUB_ASSEMBLY'), part('p1', 's1', '1.1.1', 'PART'), part('f1', 's1', '1.1.2', 'FASTENER')];

const noop = (): void => undefined;
const classesOf = (html: string, opening: RegExp): string[] => (html.match(opening)?.[1] ?? '').split(/\s+/).filter((name) => name !== '');
const visibleText = (html: string): string => html.replace(/<title>[^<]*<\/title>/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

function treeState(nodes: ReadonlyArray<PartItem> | null): PartsTreeState {
  return {
    nodes,
    loadFailed: false,
    selected: nodes?.[0] ?? null,
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
  };
}

const panel = (nodes: ReadonlyArray<PartItem> | null, editable: boolean, framed?: boolean): string =>
  renderToStaticMarkup(createElement(TreePanel, { tree: treeState(nodes), editable, ...(framed === undefined ? {} : { framed }) }));

describe('rulings 7b and 12: the arrow cell and the indent step', () => {
  const list = renderToStaticMarkup(
    createElement(PartsTreeList<PartItem>, { nodes: NODES, label: 'Parts tree', renderRow: (node: PartItem) => node.slNo, closed: new Set<string>(), onToggle: noop }),
  );

  it('keeps the 44 px arrow cell on touch and below 1024 px and makes it 24 x 36 for a mouse at 1024 px and wider', () => {
    const arrow = classesOf(list, /<button[^>]*data-branch-arrow="open"[^>]*class="([^"]*)"/);
    expect(arrow).toEqual(expect.arrayContaining(['min-h-(--control-h)', 'w-(--control-h)', 'fine-wide:min-h-(--compact-field-h)', 'fine-wide:w-s-5']));
  });

  it('gives the empty cell of a leaf row the same size, so the icons of a level line up', () => {
    const leaf = classesOf(list, /<span aria-hidden="true" class="([^"]*)" data-branch-arrow="none"/);
    expect(leaf).toEqual(expect.arrayContaining(['min-h-(--control-h)', 'w-(--control-h)', 'fine-wide:min-h-(--compact-field-h)', 'fine-wide:w-s-5']));
  });

  it('steps 24 px a level on touch and 20 px for a mouse at 1024 px and wider, with the guide line under the arrow centre', () => {
    const nested = classesOf(list, /<ul id="parts-tree-branch-m1" class="([^"]*)"/);
    expect(nested).toEqual(expect.arrayContaining(['ml-s-5', 'border-l', 'border-border', 'fine-wide:ml-s-3', 'fine-wide:pl-s-2']));
  });
});

describe('ruling 9: the row toolbar is quiet at rest', () => {
  const actions = renderToStaticMarkup(createElement(RowActions, { part: NODES[1] as PartItem, kindLabel: 'Sub-Assembly', onAdd: noop, onDelete: noop, upTo: 0, downTo: 1, onMoveTo: noop }));
  const buttons = actions
    .split('<button')
    .slice(1)
    .map((tag) => ({ name: tag.match(/aria-label="([^"]*)"/)?.[1] ?? '', classes: (tag.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/) }));
  const named = (start: string) => buttons.find((button) => button.name.startsWith(start))?.classes ?? [];

  it('has the move handle, the "+" and the "-"', () => {
    expect(buttons.map((button) => button.name.split(' ')[0])).toEqual(['Move', 'Add', 'Delete']);
  });

  it.each(['Move', 'Add', 'Delete'])('draws the %s button in ink-2 at rest, not in the brand red, with the secondary hover and pressed look', (start) => {
    const classes = named(start);
    expect(classes).toContain('text-ink-2');
    expect(classes).not.toContain('text-primary-ink');
    expect(classes).not.toContain('text-danger-ink');
    expect(classes).toContain('active:bg-border');
    expect(classes).toContain('active:shadow-pressed');
  });

  it('tints the handle and the "+" grey on hover and the "-" red on hover', () => {
    for (const start of ['Move', 'Add']) {
      expect(named(start), start).toContain('hover:bg-surface-2');
      expect(named(start), start).toContain('hover:text-ink');
    }
    const remove = named('Delete');
    expect(remove).toContain('hover:bg-danger-soft');
    expect(remove).toContain('hover:text-danger');
    expect(remove).not.toContain('hover:text-ink');
  });
});

describe('item 10: the tree is a card of its own, headed "Parts tree" with its row count', () => {
  it('has the head, the title as an h2 on the left and the count on the right, over a hairline', () => {
    const html = panel(NODES, true);
    expect(html).toMatch(/<h2[^>]*>Parts tree<\/h2>/);
    expect(html).toContain('4 rows');
    expect(html).toContain('data-slot="card-header"');
    expect(html.indexOf('data-slot="card-header"')).toBeLessThan(html.indexOf('<nav'));
    expect(html.indexOf('Parts tree</h2>')).toBeLessThan(html.indexOf('4 rows'));
  });

  it('says "1 row" for one row and counts every row, open or closed', () => {
    expect(panel([part('m1', null, '1', 'MAIN_ASSEMBLY')], true)).toContain('1 row<');
    expect(panel([part('m1', null, '1', 'MAIN_ASSEMBLY')], true)).not.toContain('1 rows');
  });

  it('shows no count while the tree is not known', () => {
    const html = panel(null, true);
    expect(html).toMatch(/<h2[^>]*>Parts tree<\/h2>/);
    expect(html).not.toMatch(/\d+ rows?</);
  });

  it('keeps the head and drops the card chrome where the panel is not framed (the phone drawer is its own surface)', () => {
    const html = panel(NODES, true, false);
    expect(html).toMatch(/<h2[^>]*>Parts tree<\/h2>/);
    expect(html).toContain('4 rows');
    expect(html).not.toContain('data-slot="card"');
  });

  it('keeps the name of the navigation landmark as it was', () => {
    expect(panel(NODES, true)).toContain('<nav aria-label="Parts tree"');
  });
});

describe('item 11: the tree column is 320 px', () => {
  it('is the one token, --tree-w: 320px', () => {
    const globals = readFileSync(fileURLToPath(new URL('../../src/app/globals.css', import.meta.url)), 'utf8').replaceAll('\r\n', '\n');
    expect(customProperties(blocksOf(globals, ':root')[0] ?? '').get('--tree-w')).toBe('320px');
  });
});

describe('item 13: "Add main assembly" is a ghost button under a hairline', () => {
  const html = panel(NODES, true);
  const foot = html.slice(html.indexOf('data-tree-foot'));

  it('sits in the foot, which starts with a hairline and holds the button and then the two legends', () => {
    expect(classesOf(html, /<div data-tree-foot="" class="([^"]*)"/)).toEqual(expect.arrayContaining(['border-t', 'border-border']));
    expect(foot.indexOf('Add main assembly')).toBeLessThan(foot.indexOf('data-tree-legend'));
    expect(foot.indexOf('data-tree-legend')).toBeLessThan(foot.indexOf('data-status-legend'));
  });

  it('is the ghost variant (red words and "+", no outline), 44 px high, not the outlined secondary', () => {
    const button = html.match(/<button[^>]*class="([^"]*)"[^>]*>(?:(?!<\/button>)[\s\S])*Add main assembly/)?.[1] ?? '';
    const classes = button.split(/\s+/);
    expect(classes).toContain('bg-transparent');
    expect(classes).toContain('text-primary-ink');
    expect(classes).not.toContain('border-border-strong');
    expect(classes).toContain('h-(--control-h)');
  });

  it('is not offered where the person may not change the inputs, and the legends are still drawn', () => {
    const read = panel(NODES, false);
    expect(read).not.toContain('Add main assembly');
    expect(read).toContain('data-tree-legend');
    expect(read).toContain('data-status-legend');
  });
});

describe('item 14: the legends', () => {
  it('has no visible "Row kinds" title and no line above it, and keeps the name for assistive technology', () => {
    const html = renderToStaticMarkup(createElement(TreeLegend));
    expect(html).toContain('aria-label="Row kinds"');
    expect(visibleText(html)).not.toContain('Row kinds');
    expect(classesOf(html, /<section[^>]*class="([^"]*)"/)).not.toContain('border-t');
  });

  it('draws the four kinds on the same 24 px tile as the rows', () => {
    const html = renderToStaticMarkup(createElement(TreeLegend));
    expect(html.split('size-s-5').length - 1).toBe(4);
  });

  describe('the status legend', () => {
    const html = panel(NODES, true);
    const legend = html.slice(html.indexOf('data-status-legend'), html.indexOf('<p role="status"'));

    it('names the four statuses with the words the rows speak', () => {
      const text = visibleText(legend);
      for (const words of ['All inputs entered', 'Some inputs entered', 'No inputs yet', 'Missing inputs']) expect(text, words).toContain(words);
    });

    it('draws the same icons at 18 px in the same inks as the rows, hidden from assistive technology beside their words', () => {
      const icons = [...legend.matchAll(/<svg[^>]*class="([^"]*)"[^>]*>/g)].map((match) => match[1] ?? '');
      const expected = [
        ['lucide-circle-check', 'text-success'],
        ['lucide-contrast', 'text-ink-2'],
        ['lucide-circle', 'text-ink-3'],
        ['lucide-triangle-alert', 'text-danger'],
      ];
      expect(icons).toHaveLength(4);
      expected.forEach(([glyph, ink], index) => {
        expect(icons[index], glyph).toMatch(new RegExp(`${glyph}(?![a-z-])`));
        expect(icons[index], ink).toContain(ink);
      });
      expect(legend.split('aria-hidden="true"').length - 1).toBe(4);
      expect(legend).not.toContain('role="img"');
      expect((legend.match(/width="18"/g) ?? []).length).toBe(4);
    });

    it('is a labelled section, so it is told apart from the legend of the kinds', () => {
      expect(html).toMatch(/<section[^>]*aria-label="Row status"[^>]*data-status-legend=""|<section[^>]*data-status-legend=""[^>]*aria-label="Row status"/);
    });
  });
});

describe('item 10: in the workspace the tree card sits beside the form card, not inside it', () => {
  const html = renderToStaticMarkup(
    createElement(EstimateWorkspace, {
      header: { code: 'Q-2026-0318', status: 'DRAFT', deadlineLabel: '12 Nov 2026, 17:00 IST', folderPath: '\\invented-server\invented-share\RFQ-0318', folderUrl: null, title: 'Invented cabinet', subject: 'Invented subject', customer: null, notes: null, assignedByName: 'Invented Lead' },
      estimateId: '00000000-0000-4000-8000-000000000001',
      userId: 'invented-user',
    }),
  );
  const formCard = html.slice(html.indexOf('data-form-area'));

  it('draws the tree column at the token width, ahead of the form card, and keeps the form card named "Parts and inputs"', () => {
    expect(html).toContain('lg:w-(--tree-w)');
    expect(html.indexOf('lg:w-(--tree-w)')).toBeLessThan(html.indexOf('data-form-area'));
    expect(formCard).toContain('Parts and inputs');
    expect(html).toMatch(/<div[^>]*data-slot="card"[^>]*role="group"[^>]*aria-labelledby="estimate-form-area-title"|<div[^>]*role="group"[^>]*aria-labelledby="estimate-form-area-title"[^>]*data-form-area=""/);
  });

  it('is a card below 1024 px and has no border, fill or padding from 1024 px, so the form keeps its width beside the 320 px tree (STORY-10.06 AC-2)', () => {
    const open = html.lastIndexOf('<div', html.indexOf('data-form-area'));
    const card = html.slice(open, html.indexOf('>', open));
    for (const name of ['lg:flex-1', 'lg:border-0', 'lg:bg-transparent', 'lg:shadow-none']) expect(card, name).toContain(name);
    // The card's own head is not drawn (DEF-097): the form's head is the mock-up's head. Its title is still there for the rows' links and the group's name.
    expect(formCard).toMatch(/data-slot="card-header" class="[^"]*sr-only/);
    expect(formCard).toMatch(/data-slot="card-content" class="[^"]*lg:p-0/);
  });

  it('has no border, fill or padding on a phone either (AQP-458, DEF-101), so the section cards keep the width two 140 px columns need at 360 px', () => {
    const open = html.lastIndexOf('<div', html.indexOf('data-form-area'));
    const card = html.slice(open, html.indexOf('>', open));
    for (const name of ['max-md:border-0', 'max-md:bg-transparent', 'max-md:shadow-none', 'max-md:rounded-none']) expect(card, name).toContain(name);
    expect(formCard).toMatch(/data-slot="card-content" class="[^"]*max-md:p-0/);
    // From 768 to 1023 px it is still a card: no unprefixed removal.
    expect(card).not.toMatch(/(^|\s)(border-0|bg-transparent|shadow-none)(\s|")/);
  });

  it('has the head "Parts tree" before the form card and none inside it', () => {
    expect(html.indexOf('Parts tree</h2>')).toBeGreaterThan(-1);
    expect(html.indexOf('Parts tree</h2>')).toBeLessThan(html.indexOf('data-form-area'));
    expect(formCard).not.toContain('Parts tree</h2>');
  });
});
