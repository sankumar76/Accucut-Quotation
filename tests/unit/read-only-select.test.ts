import { describe, expect, it, vi } from 'vitest';

import { changesAValue, readOnlySelectProps } from '@/components/features/estimate-workspace/read-only-select';

/**
 * CR-01 item 7D, AQP-401 AC-8 and review finding QLT-01: a read-only drop-down stops the keys that would change its value or open its list, and lets the browser's own shortcuts through, so a keyboard user can
 * still reload (the alert asks for it), search and go back. Every key here is a name of the keyboard, nothing else.
 */

const key = (name: string, modifiers: { ctrl?: boolean; meta?: boolean; alt?: boolean } = {}) => ({ key: name, ctrlKey: modifiers.ctrl === true, metaKey: modifiers.meta === true, altKey: modifiers.alt === true });

describe('which keys a read-only drop-down stops', () => {
  it.each(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', ' ', 'Enter', 'a', 'Z', '7'])('stops %j, which would change the value or open the list', (name) => {
    expect(changesAValue(key(name))).toBe(true);
  });

  it('stops Alt+ArrowDown and Alt+ArrowUp, which open the list', () => {
    expect(changesAValue(key('ArrowDown', { alt: true }))).toBe(true);
    expect(changesAValue(key('ArrowUp', { alt: true }))).toBe(true);
  });

  it.each([
    ['F5', key('F5')],
    ['Ctrl+R', key('r', { ctrl: true })],
    ['Cmd+R', key('r', { meta: true })],
    ['Ctrl+F', key('f', { ctrl: true })],
    ['Ctrl+L', key('l', { ctrl: true })],
    ['Alt+ArrowLeft (back)', key('ArrowLeft', { alt: true })],
    ['Alt+ArrowRight (forward)', key('ArrowRight', { alt: true })],
    ['Shift+F10 (the context menu)', key('F10')],
    ['the context-menu key', key('ContextMenu')],
    ['Tab', key('Tab')],
    ['Escape', key('Escape')],
  ])('lets %s through to the browser', (_name, event) => {
    expect(changesAValue(event)).toBe(false);
  });
});

describe('the props of a drop-down', () => {
  it('are empty when the estimate may be changed', () => {
    expect(readOnlySelectProps(false)).toEqual({});
  });

  it('prevent the default of a changing key and not of a shortcut', () => {
    const { onKeyDown } = readOnlySelectProps(true);
    const press = (name: string, modifiers: { ctrl?: boolean } = {}): boolean => {
      const preventDefault = vi.fn();
      onKeyDown?.({ ...key(name, modifiers), preventDefault } as never);
      return preventDefault.mock.calls.length > 0;
    };
    expect(press('ArrowDown')).toBe(true);
    expect(press(' ')).toBe(true);
    expect(press('F5')).toBe(false);
    expect(press('r', { ctrl: true })).toBe(false);
  });

  it('say aria-readonly', () => {
    expect(readOnlySelectProps(true)['aria-readonly']).toBe(true);
  });
});
