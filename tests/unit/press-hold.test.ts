import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attachPressHold, CLICK_WAIT_MS, createPressHold, HOLD_ATTRIBUTE, HOLD_CEILING_MS } from '@/components/features/estimate-workspace/press-hold';
import { RowActions } from '@/components/features/estimate-workspace/row-actions';
import type { PartItem } from '@/lib/estimates/tree-client';

/**
 * AQP-419 (DEF-076), rule P of the design in comment 13032: a layout never changes between a pointer going down in the tree and the end of that press. The toolbars in view at the pointer-down are held (a mark,
 * `data-hold`) until the click has run; the hold also ends on a pointer-up with no click, a pointer-cancel, the window's blur and a 5 s ceiling; and the keyboard never holds anything (acceptance checks 5 and 7).
 * The page's own behaviour at three widths is judged by the E2E case of the parts tree. Every ID and name is invented.
 */

/** A toolbar group as the hold needs it: it carries marks, and has a height the glue measures. */
function toolbar(height: number) {
  const marks = new Set<string>();
  return {
    marks,
    height,
    setAttribute: (name: string) => void marks.add(name),
    removeAttribute: (name: string) => void marks.delete(name),
    getBoundingClientRect: () => ({ height }),
    held: () => marks.has(HOLD_ATTRIBUTE),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('one press', () => {
  it('holds what is shown at the pointer-down, and lets go after the click has run, not inside it', () => {
    const shown = toolbar(42);
    const hold = createPressHold(() => [shown]);
    hold.down();
    expect(shown.held()).toBe(true);
    hold.up();
    hold.click();
    // The handlers of the click run in this same task: the rows have not settled yet.
    expect(shown.held()).toBe(true);
    vi.advanceTimersByTime(0);
    expect(shown.held()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('lets go when the pointer is up and no click comes, after the wait for a click and not before', () => {
    const shown = toolbar(42);
    const hold = createPressHold(() => [shown]);
    hold.down();
    hold.up();
    vi.advanceTimersByTime(CLICK_WAIT_MS - 1);
    expect(shown.held()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(shown.held()).toBe(false);
  });

  it('lets go at once when the pointer is cancelled or the window loses the focus (cancel)', () => {
    const shown = toolbar(42);
    const hold = createPressHold(() => [shown]);
    hold.down();
    hold.cancel();
    expect(shown.held()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('lets go after the ceiling of 5 s when nothing else ends the press', () => {
    const shown = toolbar(42);
    const hold = createPressHold(() => [shown]);
    hold.down();
    vi.advanceTimersByTime(HOLD_CEILING_MS - 1);
    expect(shown.held()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(shown.held()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('holds nothing and starts no timer when no toolbar is in view; a pointer-up or a click then does nothing', () => {
    const hold = createPressHold(() => []);
    hold.down();
    hold.up();
    hold.click();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a click that follows the pointer-up shortens the wait: the rows settle after the click, not after the wait for one', () => {
    const shown = toolbar(42);
    const hold = createPressHold(() => [shown]);
    hold.down();
    hold.up();
    hold.click();
    vi.advanceTimersByTime(0);
    expect(shown.held()).toBe(false);
  });

  it('a press that begins while another is held adds to the hold and keeps the first: nothing settles between them', () => {
    const first = toolbar(42);
    const second = toolbar(42);
    let inView = [first];
    const hold = createPressHold(() => inView);
    hold.down();
    hold.up();
    inView = [first, second];
    hold.down();
    vi.advanceTimersByTime(CLICK_WAIT_MS);
    expect(first.held()).toBe(true);
    expect(second.held()).toBe(true);
    hold.click();
    vi.advanceTimersByTime(0);
    expect(first.held()).toBe(false);
    expect(second.held()).toBe(false);
  });

  it('a second press restarts the ceiling', () => {
    const shown = toolbar(42);
    const hold = createPressHold(() => [shown]);
    hold.down();
    vi.advanceTimersByTime(HOLD_CEILING_MS - 10);
    hold.down();
    vi.advanceTimersByTime(HOLD_CEILING_MS - 10);
    expect(shown.held()).toBe(true);
    vi.advanceTimersByTime(10);
    expect(shown.held()).toBe(false);
  });
});

type Listener = (event: unknown) => void;

/** A document and a window that keep their listeners and fire them as the browser does, and a tree that holds the toolbars. */
function page(toolbars: ReadonlyArray<ReturnType<typeof toolbar>>) {
  const listeners = new Map<string, Array<{ listener: Listener; capture: boolean | undefined }>>();
  const target = {
    addEventListener: (type: string, listener: Listener, capture?: boolean) => void listeners.set(type, [...(listeners.get(type) ?? []), { listener, capture }]),
    removeEventListener: (type: string, listener: Listener) => void listeners.set(type, (listeners.get(type) ?? []).filter((kept) => kept.listener !== listener)),
  };
  const doc = { ...target, getElementById: (id: string) => (id === 'parts-tree' ? { querySelectorAll: () => toolbars } : null) };
  const win = { ...target };
  // The listeners are on `doc` and on `win` in one map: a test says which by the event it fires.
  const fire = (type: string, event: object = {}): void => (listeners.get(type) ?? []).forEach(({ listener }) => listener(event));
  return { doc: doc as unknown as Document, win: win as unknown as Window, fire, listening: () => [...listeners.entries()].filter(([, kept]) => kept.length > 0).map(([type]) => type).sort(), capture: (type: string) => (listeners.get(type) ?? []).map((kept) => kept.capture) };
}

const inTree = { closest: (selector: string) => (selector === '#parts-tree' ? {} : null) };
const outsideTree = { closest: () => null };
const mouseDown = (target: object = inTree, extra: object = {}) => ({ target, isPrimary: true, button: 0, pointerType: 'mouse', ...extra });

describe('the press in the page', () => {
  it('holds the toolbars taller than the 1 px clip at the primary pointer-down in the tree, and not the clipped ones (acceptance checks 1 to 3)', () => {
    const keyboardRow = toolbar(42);
    const clipped = toolbar(1);
    const { doc, win, fire } = page([keyboardRow, clipped]);
    attachPressHold(doc, win, 'parts-tree');
    fire('pointerdown', mouseDown());
    expect(keyboardRow.held()).toBe(true);
    expect(clipped.held()).toBe(false);
    fire('pointerup');
    fire('click');
    expect(keyboardRow.held()).toBe(true);
    vi.advanceTimersByTime(0);
    expect(keyboardRow.held()).toBe(false);
  });

  it('listens in the capture phase, so a press on a button that stops its own events is held too', () => {
    const { doc, win, capture } = page([]);
    attachPressHold(doc, win, 'parts-tree');
    expect(capture('pointerdown')).toEqual([true]);
    expect(capture('pointerup')).toEqual([true]);
    expect(capture('click')).toEqual([true]);
    expect(capture('pointercancel')).toEqual([true]);
  });

  it.each([
    ['a press outside the tree', mouseDown(outsideTree)],
    ['a pointer that is not the primary one (a second finger)', mouseDown(inTree, { isPrimary: false })],
    ['the right button of a mouse', mouseDown(inTree, { button: 2 })],
    ['a target that is not an element', mouseDown(null as unknown as object)],
  ])('holds nothing for %s', (_name, event) => {
    const shown = toolbar(42);
    const { doc, win, fire } = page([shown]);
    attachPressHold(doc, win, 'parts-tree');
    fire('pointerdown', event);
    expect(shown.held()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('holds for a finger and a pen: the primary pointer with button 0', () => {
    const shown = toolbar(44);
    const { doc, win, fire } = page([shown]);
    attachPressHold(doc, win, 'parts-tree');
    fire('pointerdown', mouseDown(inTree, { pointerType: 'touch' }));
    expect(shown.held()).toBe(true);
  });

  it('lets go when the pointer is up with no click, when it is cancelled, when the window loses the focus, and at the ceiling (acceptance check 5)', () => {
    const cases: Array<[string, () => void]> = [];
    const shown = toolbar(42);
    const { doc, win, fire } = page([shown]);
    attachPressHold(doc, win, 'parts-tree');
    cases.push(['pointerup with no click', () => (fire('pointerup'), vi.advanceTimersByTime(CLICK_WAIT_MS))]);
    cases.push(['pointercancel', () => fire('pointercancel')]);
    cases.push(['window blur', () => fire('blur')]);
    cases.push(['ceiling', () => vi.advanceTimersByTime(HOLD_CEILING_MS)]);
    for (const [name, end] of cases) {
      fire('pointerdown', mouseDown());
      expect(shown.held(), name + ' (held at the press)').toBe(true);
      end();
      expect(shown.held(), name + ' (let go)').toBe(false);
    }
  });

  it('the keyboard holds nothing: no listener for a key or for the focus, and a Tab away collapses at once (acceptance check 7)', () => {
    const shown = toolbar(42);
    const { doc, win, fire, listening } = page([shown]);
    attachPressHold(doc, win, 'parts-tree');
    expect(listening()).toEqual(['blur', 'click', 'pointercancel', 'pointerdown', 'pointerup']);
    for (const type of ['keydown', 'keyup', 'focusin', 'focusout', 'focus']) fire(type, { key: 'Tab', target: inTree });
    expect(shown.held()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('takes its listeners away and lets go when the tree is gone', () => {
    const shown = toolbar(42);
    const { doc, win, fire, listening } = page([shown]);
    const detach = attachPressHold(doc, win, 'parts-tree');
    fire('pointerdown', mouseDown());
    detach();
    expect(shown.held()).toBe(false);
    expect(listening()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('holds nothing when the tree is not on the page', () => {
    const { doc, win, fire } = page([]);
    (doc as unknown as { getElementById: () => null }).getElementById = () => null;
    attachPressHold(doc, win, 'parts-tree');
    fire('pointerdown', mouseDown());
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('the toolbar of a row reads the hold', () => {
  const part: PartItem = { id: 'p-1', parentId: null, slNo: '1', label: 'Frame', nodeKind: 'MAIN_ASSEMBLY', completeness: 'EMPTY', revision: 1 };
  const group = (showing: boolean): ReactElement<{ className: string }> =>
    RowActions({ part, onAdd: vi.fn(), onDelete: vi.fn(), upTo: null, downTo: null, onMoveTo: vi.fn(), showing }) as ReactElement<{ className: string }>;

  it('is in view while it carries data-hold, besides the open row, visible focus and an open menu, and is clipped otherwise', () => {
    const classes = group(false).props.className.split(' ');
    expect(classes).toContain('sr-only');
    expect(classes).toContain(`${HOLD_ATTRIBUTE}:not-sr-only`);
    expect(classes).toContain('group-has-[[aria-current=true]]/row:not-sr-only');
    expect(classes).toContain('group-has-[:focus-visible]/row:not-sr-only');
  });

  it('stays in view while its delete confirmation is open', () => {
    expect(group(true).props.className).toBe('not-sr-only');
  });
});
