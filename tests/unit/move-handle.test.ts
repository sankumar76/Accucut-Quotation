import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MoveHandle } from '@/components/features/estimate-workspace/move-handle';
import { MoveHandleTrigger } from '@/components/features/estimate-workspace/move-handle-trigger';
import { MoveMenu } from '@/components/features/estimate-workspace/move-menu';

import { renderHook } from '../support/hook-harness';

// The hooks are the harness's (`tests/support/hook-harness.ts`), the rest of React is real, the first-open loader is one the test drives, and the drag's code is a spy. The components are called as functions and the
// elements they return are read: no DOM is needed to pin what the handle and its menu are given and what their handlers do.
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), ...(await import('../support/hook-harness')).reactHooks }));

const mocks = vi.hoisted(() => ({
  activate: vi.fn(),
  attach: vi.fn(),
  state: { shown: false, Overlay: null as unknown, pending: false, failed: false, keyboard: false },
}));
vi.mock('@/components/shared/use-first-open', () => ({ useFirstOpen: () => ({ ...mocks.state, activate: mocks.activate }) }));
vi.mock('@/components/features/estimate-workspace/tree-reorder', () => ({ attachReorder: mocks.attach }));

/**
 * AQP-406 (CR-01 item 3D; AC-2, AC-5, AC-7): the move handle is the one control in the first load. A press and a drag start the reorder (its code loads at that pointer-down); a click, Enter, Space or an arrow-down
 * opens Move up / Move down (its code loads at the first open); the click that ends a drag opens nothing; Move up and Move down are disabled where the row cannot go, and choose the place `stepOf` gave; and the
 * handle still drags after the menu has loaded. Every ID and name is invented.
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

const triggerOf = (tree: ReactNode): ReactElement<Props> => {
  const trigger = elementsIn(tree).find((element) => element.type === MoveHandleTrigger);
  if (trigger === undefined) throw new Error('no handle in the tree');
  return trigger;
};

const call = <T>(props: Props, name: string, event: unknown): T => (props[name] as (event: unknown) => T)(event);

/** What a button gives a handler: its own `dataset` and a pointer to hold. */
const handleOf = () => ({ dataset: {} as Record<string, string>, setPointerCapture: vi.fn() });
const pointerDown = (handle: ReturnType<typeof handleOf>, extra: Props = {}) => ({ button: 0, pointerId: 7, clientY: 123, currentTarget: handle, preventDefault: vi.fn(), ...extra });

const onMoveTo = vi.fn();
const LABEL = 'Move 1.1 Base frame';
const handle = (extra: Props = {}) => MoveHandle({ id: 'move-p1', label: LABEL, upTo: 0, downTo: 2, onMoveTo, ...extra } as Parameters<typeof MoveHandle>[0]);

beforeEach(() => {
  mocks.activate.mockReset();
  mocks.attach.mockReset();
  onMoveTo.mockReset();
  mocks.state = { shown: false, Overlay: null, pending: false, failed: false, keyboard: false };
});

describe('AC-2, AC-7: the handle before the menu has loaded', () => {
  it('is a plain button named after its row, with the face of the menu trigger that replaces it', () => {
    const trigger = triggerOf(handle());
    expect(trigger.props).toMatchObject({ label: LABEL, 'aria-haspopup': 'menu', 'aria-expanded': false });
    expect(trigger.props['aria-busy']).toBeUndefined();
  });

  it('opens the menu on a pointer click and on Enter or Space (a click with no position), and on an arrow-down', () => {
    const { props } = triggerOf(handle());
    call(props, 'onClick', { detail: 1, currentTarget: handleOf() });
    expect(mocks.activate).toHaveBeenLastCalledWith(false);
    call(props, 'onClick', { detail: 0, currentTarget: handleOf() });
    expect(mocks.activate).toHaveBeenLastCalledWith(true);
    const key = { key: 'ArrowDown', preventDefault: vi.fn() };
    call(props, 'onKeyDown', key);
    expect(mocks.activate).toHaveBeenLastCalledWith(true);
    expect(key.preventDefault).toHaveBeenCalled();
    call(props, 'onKeyDown', { key: 'a', preventDefault: vi.fn() });
    expect(mocks.activate).toHaveBeenCalledTimes(3);
  });

  it('opens nothing on the click that ends a drag, and clears the mark so the next click opens it', () => {
    const { props } = triggerOf(handle());
    const dragged = handleOf();
    dragged.dataset['dragged'] = '';
    call(props, 'onClick', { detail: 1, currentTarget: dragged });
    expect(mocks.activate).not.toHaveBeenCalled();
    expect('dragged' in dragged.dataset).toBe(false);
    call(props, 'onClick', { detail: 1, currentTarget: dragged });
    expect(mocks.activate).toHaveBeenCalledTimes(1);
  });

  it('says it is busy while the menu\'s code is on its way, and shows the line when it did not come', () => {
    mocks.state = { ...mocks.state, pending: true };
    expect(triggerOf(handle()).props['aria-busy']).toBe(true);
    mocks.state = { ...mocks.state, pending: false, failed: true };
    const tree = handle();
    expect(triggerOf(tree).props['aria-describedby']).toBe('move-p1-failure');
    expect(elementsIn(tree).some((element) => element.props['id'] === 'move-p1-failure')).toBe(true);
  });

  it('hands over to the loaded menu with the places and the way it was opened', () => {
    const Menu = vi.fn();
    mocks.state = { shown: true, Overlay: Menu, pending: false, failed: false, keyboard: true };
    const shown = handle();
    expect(shown.type).toBe(Menu);
    expect(shown.props).toMatchObject({ label: LABEL, upTo: 0, downTo: 2, onMoveTo, keyboard: true });
  });
});

describe('AQP-343 state: while a change to the tree is on its way (DL-340)', () => {
  it('is aria-disabled, described by the line when it is on screen, and does nothing: no drag, no click, no arrow', async () => {
    const tree = handle({ unavailable: true, describedBy: 'parts-tree-changing' });
    const trigger = triggerOf(tree);
    expect(trigger.props).toMatchObject({ unavailable: true, 'aria-describedby': 'parts-tree-changing' });
    const held = handleOf();
    call(trigger.props, 'onPointerDown', pointerDown(held));
    call(trigger.props, 'onClick', { detail: 1, currentTarget: handleOf() });
    call(trigger.props, 'onKeyDown', { key: 'ArrowDown', preventDefault: vi.fn() });
    await Promise.resolve();
    expect(held.setPointerCapture).not.toHaveBeenCalled();
    expect(mocks.attach).not.toHaveBeenCalled();
    expect(mocks.activate).not.toHaveBeenCalled();
  });

  it('is as it was when nothing is on its way', () => {
    expect(triggerOf(handle()).props['unavailable']).toBeUndefined();
  });

  it('hands the state to the loaded menu', () => {
    const Menu = vi.fn();
    mocks.state = { shown: true, Overlay: Menu, pending: false, failed: false, keyboard: false };
    expect(handle({ unavailable: true, describedBy: 'parts-tree-changing' }).props).toMatchObject({ unavailable: true, describedBy: 'parts-tree-changing' });
    expect(handle().props).not.toHaveProperty('unavailable');
  });
});

describe('AC-1, AC-5: a press on the handle starts a drag, and its code is fetched then', () => {
  it('holds the pointer and starts the reorder with the pointer, the height it went down at and the way to move the row', async () => {
    const { props } = triggerOf(handle());
    const held = handleOf();
    call(props, 'onPointerDown', pointerDown(held));
    expect(held.setPointerCapture).toHaveBeenCalledWith(7);
    await vi.waitFor(() => expect(mocks.attach).toHaveBeenCalledTimes(1));
    expect(mocks.attach).toHaveBeenCalledWith({ handle: held, pointerId: 7, startY: 123, onDrop: onMoveTo });
  });

  it('does not start a drag for the right button', async () => {
    const { props } = triggerOf(handle());
    const held = handleOf();
    call(props, 'onPointerDown', pointerDown(held, { button: 2 }));
    expect(held.setPointerCapture).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(mocks.attach).not.toHaveBeenCalled();
  });
});

describe('AC-2: the loaded menu', () => {
  const menu = (extra: Props = {}) => renderHook(MoveMenu, { label: LABEL, upTo: 0, downTo: 2, onMoveTo, keyboard: false, ...extra } as Parameters<typeof MoveMenu>[0]);
  const rootOf = (tree: ReactNode): ReactElement<Props> => {
    const [root] = elementsIn(tree);
    if (root === undefined) throw new Error('no menu');
    return root;
  };
  const itemsOf = (tree: ReactNode) => elementsIn(tree).filter((element) => element.props['onSelect'] !== undefined);

  it('has Move up and Move down, and each takes the row to the place `stepOf` gave', () => {
    const [up, down] = itemsOf(menu().render());
    expect(up?.props['disabled']).toBe(false);
    expect(down?.props['disabled']).toBe(false);
    call(up?.props ?? {}, 'onSelect', undefined);
    call(down?.props ?? {}, 'onSelect', undefined);
    expect(onMoveTo.mock.calls).toEqual([[0], [2]]);
  });

  it('disables Move up on the first sibling, Move down on the last, and both for an only child, and chooses nothing there', () => {
    for (const [upTo, downTo] of [
      [null, 1],
      [1, null],
      [null, null],
    ] as const) {
      onMoveTo.mockReset();
      const [up, down] = itemsOf(menu({ upTo, downTo }).render());
      expect(up?.props['disabled']).toBe(upTo === null);
      expect(down?.props['disabled']).toBe(downTo === null);
      call(up?.props ?? {}, 'onSelect', undefined);
      call(down?.props ?? {}, 'onSelect', undefined);
      expect(onMoveTo).toHaveBeenCalledTimes((upTo === null ? 0 : 1) + (downTo === null ? 0 : 1));
    }
  });

  it('is open at first, closes on a pointer click on the handle and opens on the next, and a click made by Enter or Space does not toggle it (Radix does that)', () => {
    const hook = menu();
    expect(rootOf(hook.render()).props['open']).toBe(true);
    call(triggerOf(hook.render()).props, 'onClick', { detail: 1, currentTarget: handleOf() });
    expect(rootOf(hook.render()).props['open']).toBe(false);
    call(triggerOf(hook.render()).props, 'onClick', { detail: 0, currentTarget: handleOf() });
    expect(rootOf(hook.render()).props['open']).toBe(false);
    call(triggerOf(hook.render()).props, 'onClick', { detail: 1, currentTarget: handleOf() });
    expect(rootOf(hook.render()).props['open']).toBe(true);
    call(rootOf(hook.render()).props, 'onOpenChange', false);
    expect(rootOf(hook.render()).props['open']).toBe(false);
  });

  it('still drags: a pointer-down on the handle starts the reorder and keeps Radix from toggling the menu on it', async () => {
    const hook = menu();
    const held = handleOf();
    const event = pointerDown(held);
    call(triggerOf(hook.render()).props, 'onPointerDown', event);
    expect(event.preventDefault).toHaveBeenCalled();
    await vi.waitFor(() => expect(mocks.attach).toHaveBeenCalledTimes(1));
    expect(mocks.attach).toHaveBeenCalledWith({ handle: held, pointerId: 7, startY: 123, onDrop: onMoveTo });
  });

  it('opens nothing on the click that ends a drag', () => {
    const hook = menu();
    const dragged = handleOf();
    dragged.dataset['dragged'] = '';
    call(triggerOf(hook.render()).props, 'onClick', { detail: 1, currentTarget: dragged });
    expect(rootOf(hook.render()).props['open']).toBe(true);
    expect('dragged' in dragged.dataset).toBe(false);
  });

  it('while a change is on its way: the trigger is unavailable, no drag starts, it does not open again, and an open menu has its items disabled', async () => {
    const hook = menu({ unavailable: true, describedBy: 'parts-tree-changing' });
    const tree = hook.render();
    expect(triggerOf(tree).props).toMatchObject({ unavailable: true, 'aria-describedby': 'parts-tree-changing' });
    for (const item of itemsOf(tree)) expect(item.props['disabled']).toBe(true);
    const held = handleOf();
    call(triggerOf(tree).props, 'onPointerDown', pointerDown(held));
    call(triggerOf(tree).props, 'onClick', { detail: 1, currentTarget: handleOf() });
    await Promise.resolve();
    expect(mocks.attach).not.toHaveBeenCalled();
    expect(rootOf(hook.render()).props['open']).toBe(true);
    call(rootOf(hook.render()).props, 'onOpenChange', false);
    expect(rootOf(hook.render()).props['open']).toBe(false);
    call(rootOf(hook.render()).props, 'onOpenChange', true);
    expect(rootOf(hook.render()).props['open']).toBe(false);
  });

  it('has the name of the row on its trigger, the same as the handle it replaces', () => {
    expect(triggerOf(menu().render()).props['label']).toBe(LABEL);
  });
});
