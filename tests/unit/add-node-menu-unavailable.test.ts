import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddNodeMenu } from '@/components/features/estimate-workspace/add-node-menu';
import { AddNodeMenuPanel } from '@/components/features/estimate-workspace/add-node-menu-panel';
import { AddNodeTrigger, UNAVAILABLE_LOOK } from '@/components/features/estimate-workspace/add-node-trigger';
import { RowActions } from '@/components/features/estimate-workspace/row-actions';
import type { PartItem } from '@/lib/estimates/tree-client';

import { renderHook } from '../support/hook-harness';

// The hooks are the harness's (`tests/support/hook-harness.ts`), the rest of React is real, and the first-open loader is replaced by one the test drives. The components are called as functions and the elements
// they return are read: no DOM is needed to pin what each control is given and what its handlers do.
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), ...(await import('../support/hook-harness')).reactHooks }));

const first = vi.hoisted(() => ({
  activate: vi.fn(),
  state: { shown: false, Overlay: null as unknown, pending: false, failed: false, keyboard: false },
}));
vi.mock('@/components/shared/use-first-open', () => ({ useFirstOpen: () => ({ ...first.state, activate: first.activate }) }));

/**
 * AQP-343 (DL-340, DL-341): while a change to the parts tree is on its way, the "+" of a row is `aria-disabled` and keeps the focus, its menu does not open by pointer, Enter, Space or an arrow key, an open menu has its
 * items disabled, and the trigger before the menu's code has loaded is in the same state as the one after. Absent `unavailable` changes nothing. Every ID and name is invented.
 */

type Props = Record<string, unknown>;

/** Every element in the tree the component returned (children and props that hold elements are walked; a function component is not run). */
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

const triggerOf = (tree: ReactNode): ReactElement<Props> => {
  const trigger = elementsIn(tree).find((element) => element.type === AddNodeTrigger);
  if (trigger === undefined) throw new Error('no trigger in the tree');
  return trigger;
};

const KINDS = ['PART', 'FASTENER'] as const;
const press = { detail: 1 };
const arrowDown = () => ({ key: 'ArrowDown', preventDefault: vi.fn() });

beforeEach(() => {
  first.activate.mockReset();
  first.state = { shown: false, Overlay: null, pending: false, failed: false, keyboard: false };
});

describe('the trigger before the menu has loaded', () => {
  const menu = (extra: Props = {}) => AddNodeMenu({ id: 'add-node-x', label: 'Add under 1 Hopper', nodeKinds: KINDS, onChoose: vi.fn(), ...extra });

  it('opens on a press and on an arrow key when nothing is on its way, and is not aria-disabled', () => {
    const trigger = triggerOf(menu());
    expect(trigger.props['unavailable']).toBeUndefined();
    (trigger.props['onClick'] as (event: unknown) => void)(press);
    expect(first.activate).toHaveBeenCalledWith(false);
    const key = arrowDown();
    (trigger.props['onKeyDown'] as (event: unknown) => void)(key);
    expect(first.activate).toHaveBeenCalledTimes(2);
    expect(key.preventDefault).toHaveBeenCalled();
  });

  it('is aria-disabled, described by the line that says why, and does not open by a press or an arrow key while a change is on its way', () => {
    const trigger = triggerOf(menu({ unavailable: true, describedBy: 'parts-tree-changing' }));
    expect(trigger.props['unavailable']).toBe(true);
    expect(trigger.props['aria-describedby']).toBe('parts-tree-changing');
    (trigger.props['onClick'] as (event: unknown) => void)(press);
    (trigger.props['onKeyDown'] as (event: unknown) => void)(arrowDown());
    expect(first.activate).not.toHaveBeenCalled();
  });

  it('is not described by anything while the line is not on screen', () => {
    expect(triggerOf(menu({ unavailable: true })).props['aria-describedby']).toBeUndefined();
  });

  it('hands the state on to the loaded menu: the same one as the trigger it replaces', () => {
    const Panel = vi.fn();
    first.state = { shown: true, Overlay: Panel, pending: false, failed: false, keyboard: false };
    const shown = menu({ unavailable: true, describedBy: 'parts-tree-changing' });
    expect(shown.type).toBe(Panel);
    expect(shown.props).toMatchObject({ unavailable: true, describedBy: 'parts-tree-changing' });
    expect(menu().props).not.toHaveProperty('unavailable');
  });
});

describe('the loaded menu', () => {
  const panel = (extra: Props = {}) =>
    renderHook(AddNodeMenuPanel, { label: 'Add under 1 Hopper', nodeKinds: KINDS, onChoose: vi.fn(), keyboard: false, ...extra } as Parameters<typeof AddNodeMenuPanel>[0]);
  const menuOf = (tree: ReactNode): ReactElement<Props> => {
    const found = elementsIn(tree)[0];
    if (found === undefined) throw new Error('no menu');
    return found;
  };

  it('is open at first, and Radix may close it and open it again when nothing is on its way', () => {
    const hook = panel();
    expect(menuOf(hook.render()).props['open']).toBe(true);
    (menuOf(hook.render()).props['onOpenChange'] as (open: boolean) => void)(false);
    expect(menuOf(hook.render()).props['open']).toBe(false);
    (menuOf(hook.render()).props['onOpenChange'] as (open: boolean) => void)(true);
    expect(menuOf(hook.render()).props['open']).toBe(true);
  });

  it('does not open again by a press, Enter, Space or an arrow key while a change is on its way, and can still be closed', () => {
    const hook = panel({ unavailable: true });
    (menuOf(hook.render()).props['onOpenChange'] as (open: boolean) => void)(false);
    expect(menuOf(hook.render()).props['open']).toBe(false);
    (menuOf(hook.render()).props['onOpenChange'] as (open: boolean) => void)(true);
    expect(menuOf(hook.render()).props['open']).toBe(false);
  });

  it('gives its trigger the same state as the one before the load, and disables the items of a menu that is open', () => {
    const tree = panel({ unavailable: true, describedBy: 'parts-tree-changing' }).render();
    expect(triggerOf(tree).props).toMatchObject({ unavailable: true, 'aria-describedby': 'parts-tree-changing' });
    const items = elementsIn(tree).filter((element) => element.props['onSelect'] !== undefined);
    expect(items).toHaveLength(KINDS.length);
    for (const item of items) expect(item.props['disabled']).toBe(true);
  });

  it('leaves the items enabled and the trigger as it was when nothing is on its way', () => {
    const tree = panel().render();
    expect(triggerOf(tree).props['unavailable']).toBeUndefined();
    for (const item of elementsIn(tree).filter((element) => element.props['onSelect'] !== undefined)) expect(item.props['disabled']).toBe(false);
  });
});

describe('the "+" and the "-" of a row', () => {
  const part = (nodeKind: PartItem['nodeKind']): PartItem => ({ id: 'p1', parentId: 'm1', slNo: '1.1', label: 'Plate', nodeKind, completeness: 'EMPTY', revision: 1 });
  const PLACES = { upTo: 0, downTo: 2, onMoveTo: vi.fn() };
  const buttons = (tree: ReactNode) => elementsIn(tree).filter((element) => typeof element.props['aria-label'] === 'string' || element.type === AddNodeTrigger);

  it('puts the direct "+" and the "-" out of reach while a change is on its way: aria-disabled, the look, described by the line, and a press does nothing', () => {
    const onAdd = vi.fn();
    const onDelete = vi.fn();
    const tree = RowActions({ part: part('PART'), onAdd, onDelete, ...PLACES, busy: true, describedBy: 'parts-tree-changing' });
    const [add, remove] = buttons(tree);
    expect(add?.props).toMatchObject({ unavailable: true, 'aria-describedby': 'parts-tree-changing' });
    expect(add?.props['onClick']).toBeUndefined();
    expect(remove?.props).toMatchObject({ 'aria-disabled': true, 'aria-describedby': 'parts-tree-changing' });
    expect(String(remove?.props['className'])).toContain(UNAVAILABLE_LOOK);
    expect(remove?.props['onClick']).toBeUndefined();
    expect(onAdd).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('does not describe them by a line that is not on screen', () => {
    const [add, remove] = buttons(RowActions({ part: part('PART'), onAdd: vi.fn(), onDelete: vi.fn(), ...PLACES, busy: true }));
    expect(add?.props).not.toHaveProperty('aria-describedby');
    expect(remove?.props).not.toHaveProperty('aria-describedby');
  });

  it('leaves them as they were when nothing is on its way, and a press goes through', () => {
    const onAdd = vi.fn();
    const onDelete = vi.fn();
    const [add, remove] = buttons(RowActions({ part: part('PART'), onAdd, onDelete, ...PLACES }));
    expect(add?.props['unavailable']).toBe(false);
    expect(remove?.props).not.toHaveProperty('aria-disabled');
    (add?.props['onClick'] as () => void)();
    (remove?.props['onClick'] as () => void)();
    expect(onAdd).toHaveBeenCalledWith('p1', 'FASTENER');
    expect(onDelete).toHaveBeenCalledWith('p1');
  });

  it('hands the state to the "+" menu of a Main Assembly row', () => {
    const menu = elementsIn(RowActions({ part: part('MAIN_ASSEMBLY'), onAdd: vi.fn(), onDelete: vi.fn(), ...PLACES, busy: true, describedBy: 'parts-tree-changing' })).find((element) => element.type === AddNodeMenu);
    expect(menu?.props).toMatchObject({ unavailable: true, describedBy: 'parts-tree-changing' });
  });
});
