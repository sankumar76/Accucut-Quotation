import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AddNodeMenu } from '@/components/features/estimate-workspace/add-node-menu';
import { RowActions } from '@/components/features/estimate-workspace/row-actions';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { parentIdsHoldingPart, type NodeKind } from '@/lib/estimate/node-kinds';
import type { PartItem } from '@/lib/estimates/tree-client';

import { renderPanel, type MenuPanelProps } from '../support/menu-panel';

// The components are called as functions and the elements they return are read, as in `add-node-menu-unavailable.test.ts`: no DOM is needed to pin what the menu says and what a choice sends.
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), ...(await import('../support/hook-harness')).reactHooks }));
vi.mock('@/components/shared/use-first-open', () => ({
  useFirstOpen: () => ({ shown: false, Overlay: null, pending: false, failed: false, keyboard: false, activate: vi.fn() }),
}));

/**
 * AQP-449 (DEF-092, option A; ux-expert ruling 2026-11-26, MENU-1 and MENU-3): the "+" menu has one Part item. It reads "Part" when the row holds no Part yet and "Sub-part" when it already holds one or more, in
 * the item's name as well as in its text, and it always adds a PART (the kind is stored; "Sub-part" is only a name, SPEC 6.1, FR-043, ADR-020 K1). The menu has a header and one hint per item. Names are invented.
 */

type Props = Record<string, unknown>;

function elementsIn(node: ReactNode, found: ReactElement<Props>[] = []): ReactElement<Props>[] {
  if (Array.isArray(node)) {
    for (const child of node) elementsIn(child as ReactNode, found);
  } else if (typeof node === 'object' && node !== null && 'props' in node) {
    const element = node as ReactElement<Props>;
    found.push(element);
    elementsIn(element.props['children'] as ReactNode, found);
  }
  return found;
}

/** The words an element shows: its strings, no function component run. */
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map((child) => textOf(child as ReactNode)).join('');
  if (typeof node === 'object' && node !== null && 'props' in node) return textOf((node as ReactElement<Props>).props['children'] as ReactNode);
  return '';
}

const SUB_ASSEMBLY_MENU: ReadonlyArray<NodeKind> = ['PART', 'FASTENER'];
const MAIN_ASSEMBLY_MENU: ReadonlyArray<NodeKind> = ['SUB_ASSEMBLY', 'PART', 'FASTENER'];

function menu(nodeKinds: ReadonlyArray<NodeKind>, extra: Props = {}) {
  const onChoose = vi.fn();
  const tree = renderPanel({ label: 'Add under 1.1 Frame', nodeKinds, onChoose, keyboard: false, ...extra } as MenuPanelProps).render();
  const items = elementsIn(tree).filter((element) => element.type === DropdownMenuItem);
  const header = elementsIn(tree).find((element) => 'data-menu-header' in element.props);
  return { items, header, onChoose };
}

/**
 * The name of an item as a screen reader says it: the words of its name span. The item has no `aria-label` (axe `label-content-name-mismatch`, WCAG 2.5.3: a name that is not the visible text is a violation), and its hint
 * is `aria-hidden`, so the hint is not part of the name; it is the item's description (`aria-describedby`, which may point at hidden text).
 */
const nameOf = (item: ReactElement<Props> | undefined): string => textOf(elementsIn(item?.props['children'] as ReactNode).find((element) => 'data-item-name' in element.props)?.props['children'] as ReactNode);
const names = (items: ReadonlyArray<ReactElement<Props>>): unknown[] => items.map((item) => nameOf(item));

describe('AQP-449: the Part item of the "+" menu names what the person will get', () => {
  it.each([
    ['a Sub-Assembly', SUB_ASSEMBLY_MENU],
    ['a Main Assembly', MAIN_ASSEMBLY_MENU],
  ])('reads "Part" under %s that holds no Part, with the hint for the first part', (_row, kinds) => {
    const { items } = menu(kinds, { holdsPart: false });
    const item = items.find((candidate) => nameOf(candidate) === 'Part');
    expect(textOf(item?.props['children'] as ReactNode)).toBe('PartThe first part under this row. A second one is called "Sub-part"');
    expect(names(items)).not.toContain('Sub-part');
  });

  it.each([
    ['a Sub-Assembly', SUB_ASSEMBLY_MENU],
    ['a Main Assembly', MAIN_ASSEMBLY_MENU],
  ])('reads "Sub-part", in its name and its text, under %s that already holds a Part, with the hint that both are called so', (_row, kinds) => {
    const { items } = menu(kinds, { holdsPart: true });
    const item = items.find((candidate) => nameOf(candidate) === 'Sub-part');
    expect(textOf(item?.props['children'] as ReactNode)).toBe('Sub-partA part is already here, so both are called "Sub-part"');
    expect(names(items)).not.toContain('Part');
  });

  it.each([false, true])('always adds a PART, and offers one such item, never both names (holds a Part: %s)', (holdsPart) => {
    const { items, onChoose } = menu(MAIN_ASSEMBLY_MENU, { holdsPart });
    expect(items).toHaveLength(3);
    (items[1]?.props['onSelect'] as () => void)();
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith('PART');
  });

  it('keeps the order: Sub-Assembly, Part or Sub-part, Fastener (Main Assembly); Part or Sub-part, Fastener (Sub-Assembly)', () => {
    expect(names(menu(MAIN_ASSEMBLY_MENU, { holdsPart: true }).items)).toEqual(['Sub-Assembly', 'Sub-part', 'Fastener']);
    expect(names(menu(SUB_ASSEMBLY_MENU, { holdsPart: false }).items)).toEqual(['Part', 'Fastener']);
  });

  it('reads "Part" when the prop is absent', () => {
    expect(names(menu(SUB_ASSEMBLY_MENU).items)).toEqual(['Part', 'Fastener']);
  });

  it('describes each item by its hint, so the name stays the plain word and the hint is read as the description', () => {
    const { items } = menu(MAIN_ASSEMBLY_MENU, { holdsPart: true });
    for (const item of items) {
      const hintId = item.props['aria-describedby'];
      expect(typeof hintId).toBe('string');
      const hint = elementsIn(item.props['children'] as ReactNode).find((element) => element.props['id'] === hintId);
      expect(hint?.props['aria-hidden']).toBe(true);
      // No `aria-label`: the name is the visible name span (WCAG 2.5.3, axe label-content-name-mismatch).
      expect(item.props).not.toHaveProperty('aria-label');
    }
  });
});

describe('AQP-449: the header and the hints of the other items (MENU-1)', () => {
  it('has the header "Add under <Sl. No> <name>", as text only and hidden from assistive technology (the menu is named by its trigger)', () => {
    const { header } = menu(MAIN_ASSEMBLY_MENU);
    expect(textOf(header?.props['children'] as ReactNode)).toBe('Add under 1.1 Frame');
    expect(header?.props['aria-hidden']).toBe(true);
  });

  it('gives the Sub-Assembly and the Fastener their hints', () => {
    const texts = menu(MAIN_ASSEMBLY_MENU).items.map((item) => textOf(item.props['children'] as ReactNode));
    expect(texts[0]).toBe('Sub-AssemblyA group of parts and fasteners');
    expect(texts[2]).toBe('FastenerA bought-out item, same inputs as a part');
  });
});

describe('AQP-449: which rows hold a Part (parentIdsHoldingPart)', () => {
  const node = (id: string, parentId: string | null, nodeKind: NodeKind) => ({ id, parentId, nodeKind });
  const under = (parent: NodeKind, children: ReadonlyArray<NodeKind>) => [node('p', null, parent), ...children.map((kind, index) => node(`c${index}`, 'p', kind))];

  it.each(['MAIN_ASSEMBLY', 'SUB_ASSEMBLY'] as const)('counts a %s with no Part, one Part and two Parts: it holds a Part from the first one on', (parent) => {
    expect(parentIdsHoldingPart(under(parent, [])).has('p')).toBe(false);
    expect(parentIdsHoldingPart(under(parent, ['PART'])).has('p')).toBe(true);
    expect(parentIdsHoldingPart(under(parent, ['PART', 'PART'])).has('p')).toBe(true);
  });

  it('does not count Sub-Assembly or Fastener children, nor the Parts of a deeper row', () => {
    const holders = parentIdsHoldingPart([node('p', null, 'MAIN_ASSEMBLY'), node('s', 'p', 'SUB_ASSEMBLY'), node('f', 'p', 'FASTENER'), node('deep', 's', 'PART')]);
    expect(holders.has('p')).toBe(false);
    expect(holders.has('s')).toBe(true);
  });
});

describe('AQP-449: the row hands the fact on to its menu', () => {
  const row = (nodeKind: NodeKind): PartItem => ({ id: 'row-1', parentId: null, slNo: '1', label: 'Frame', nodeKind, completeness: 'EMPTY', revision: 1 });
  const rest = { upTo: null, downTo: null, onMoveTo: vi.fn(), onAdd: vi.fn(), onDelete: vi.fn() };

  it.each([true, false])('passes holdsPart=%s to the menu', (holdsPart) => {
    const found = elementsIn(RowActions({ part: row('MAIN_ASSEMBLY'), kindLabel: 'Main Assembly', ...rest, holdsPart })).find((element) => element.type === AddNodeMenu);
    expect(found?.props['holdsPart']).toBe(holdsPart);
  });

  it('gives false when the row is given no fact', () => {
    const found = elementsIn(RowActions({ part: row('SUB_ASSEMBLY'), kindLabel: 'Sub-Assembly', ...rest })).find((element) => element.type === AddNodeMenu);
    expect(found?.props['holdsPart']).toBe(false);
  });
});
