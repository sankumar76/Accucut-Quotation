import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RowActions } from '@/components/features/estimate-workspace/row-actions';
import { ROW_ACTION_LOOK } from '@/components/features/estimate-workspace/add-node-trigger';
import { PartsTreeList, type PartsTreeItem } from '@/components/shared/parts-tree-list';

/**
 * DEF-129 and DEF-132 (AQP-486; UX ruling `tree-toolbar-no-shift-2026-11-27.md`, checks TS-1, TS-5, TS-6, TS-8, TS-9, TS-10, TS-11; master DL-440): the toolbar of a row never moves a row. For a mouse each row has a toolbar slot of a fixed
 * least height (`--tree-slot-h`: 40 px from 1024 px with a fine pointer, 48 px below) whether the toolbar is in view or not, and the toolbar fills it, so showing or hiding it changes no height. The pixels themselves are measured in
 * `estimate-tree-names.spec.ts` in a browser; these tests pin the class names and the tokens that produce them, and the one rule that a hidden toolbar is clipped, never made see-through. Every name is invented.
 */

const css = readFileSync(fileURLToPath(new URL('../../src/app/globals.css', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const NODES: ReadonlyArray<PartsTreeItem> = [
  { id: 'm1', parentId: null, slNo: '1', nodeKind: 'MAIN_ASSEMBLY' },
  { id: 's1', parentId: 'm1', slNo: '1.1', nodeKind: 'SUB_ASSEMBLY' },
];
const listWith = (toolbar: boolean): string =>
  renderToStaticMarkup(
    createElement(PartsTreeList, {
      nodes: NODES,
      label: 'Parts tree',
      renderRow: (node: PartsTreeItem) => createElement('a', { href: '#x' }, node.slNo),
      ...(toolbar ? { renderToolbar: () => createElement('div', { 'data-row-actions': '' }, 'toolbar') } : {}),
    }),
  );

describe('the toolbar slot of a row (the slot is reserved for a mouse)', () => {
  it('has the least height of the slot token for a mouse, on every row that has a toolbar', () => {
    const html = listWith(true);
    const slots = html.match(/<div data-row-toolbar="" class="([^"]*)"/g) ?? [];
    expect(slots).toHaveLength(NODES.length);
    for (const slot of slots) expect(slot).toContain('mouse:min-h-(--tree-slot-h)');
  });

  it('has no slot at all on a tree with no toolbar (SCR-07, a locked tree, a person who may not edit): the heights it has today', () => {
    expect(listWith(false)).not.toContain('data-row-toolbar');
    expect(listWith(false)).not.toContain('tree-slot-h');
  });

  it('reserves nothing for a finger: the slot class is the mouse variant only (TS-8)', () => {
    const slot = listWith(true).match(/<div data-row-toolbar="" class="([^"]*)"/)?.[1] ?? '';
    expect(slot.split(/\s+/).filter((token) => token.includes('min-h'))).toEqual(['mouse:min-h-(--tree-slot-h)']);
  });
});

describe('the token of the slot (TS-5, TS-10)', () => {
  it('is 48 px by default and 40 px from 1024 px with a fine pointer, which is where the buttons are 36 px (a 38 px toolbar and a 2 px gap) and below it 44 px (a 46 px toolbar and the gap)', () => {
    expect(css).toMatch(/--tree-slot-h: 48px;/);
    expect(css).toMatch(/@media \(min-width: 1024px\) and \(pointer: fine\) \{\n {2}:root \{\n {4}--tree-slot-h: 40px;/);
    // The buttons the slot is made for: 36 px from 1024 px with a fine pointer, 44 px otherwise.
    expect(css).toMatch(/--control-h: 44px;/);
    expect(css).toMatch(/--control-h-row: 36px;/);
  });
});

describe('the toolbar inside the slot (TS-5, TS-6, TS-9)', () => {
  const actions = renderToStaticMarkup(
    createElement(RowActions, {
      part: { id: 'p1', parentId: null, slNo: '1', label: 'Hopper', nodeKind: 'MAIN_ASSEMBLY', completeness: 'EMPTY', revision: 1 },
      kindLabel: 'Main Assembly',
      onAdd: () => undefined,
      onDelete: () => undefined,
      upTo: null,
      downTo: null,
      onMoveTo: () => undefined,
    }),
  );

  it('sits 2 px under the row\'s text, so a 36 px mouse toolbar (38 px with its border) fills the 40 px slot exactly', () => {
    expect(actions).toContain('mt-[2px]');
    expect(actions).not.toContain('mt-s-1');
  });

  it('is clipped to 1 px when it is not in view, never see-through, so an empty slot takes no press (TS-6)', () => {
    const group = actions.match(/<div data-row-actions="" [^>]*class="([^"]*)"/)?.[1] ?? '';
    expect(group).toContain('sr-only');
    for (const token of group.split(/\s+/)) expect(token, token).not.toMatch(/(^|:)(opacity|invisible|hidden|collapse)/);
    expect(actions).not.toContain('opacity-0');
  });

  it('gives every button a scroll margin of 40 px so a focused button is wholly in view above a sticky bar (WCAG 2.4.11)', () => {
    expect(ROW_ACTION_LOOK).toContain('[scroll-margin-block:40px]');
  });
});
