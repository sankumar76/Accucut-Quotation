import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { EARLY_INTENT_GLOBAL, finishEarlyIntent, readEarlyIntent } from '@/lib/ui/early-intent';
import { EARLY_INTENT_SCRIPT } from '@/lib/ui/early-intent-script';

/**
 * AQP-188 AC-10 (DEF-013): the capture logic of a tap made before the page is interactive. The script is plain
 * text that runs in the page, so it is run here against a stand-in for the parts of the document it touches. The
 * browser test (`tests/e2e/shell-lazy-load.spec.ts`) shows the whole path, 20 of 20 runs per width.
 */

type Listener = (event: FakeEvent) => void;

interface FakeEvent {
  target: FakeElement | null;
  detail: number;
  key: string;
}

class FakeElement {
  readonly attributes = new Map<string, string>();
  constructor(
    attributes: Record<string, string>,
    private readonly parent: FakeElement | null = null,
  ) {
    Object.entries(attributes).forEach(([name, value]) => this.attributes.set(name, value));
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  /** Only the `[attribute]` selector form, which is all the script uses. */
  closest(selector: string): FakeElement | null {
    const name = /^\[([\w-]+)\]$/.exec(selector)?.[1];
    if (name === undefined) throw new Error(`unexpected selector ${selector}`);
    if (this.attributes.has(name)) return this;
    return this.parent === null ? null : this.parent.closest(selector);
  }
}

class FakeDocument {
  readonly listeners = new Map<string, Array<{ listener: Listener; capture: boolean }>>();
  constructor(private readonly controls: ReadonlyArray<FakeElement>) {}
  addEventListener(type: string, listener: Listener, capture: boolean): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), { listener, capture }]);
  }
  removeEventListener(type: string, listener: Listener, capture: boolean): void {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((entry) => entry.listener !== listener || entry.capture !== capture),
    );
  }
  querySelector(selector: string): FakeElement | null {
    const match = /^\[([\w-]+)="([^"]*)"\]$/.exec(selector);
    if (match === null) throw new Error(`unexpected selector ${selector}`);
    return this.controls.find((control) => control.getAttribute(match[1] ?? '') === match[2]) ?? null;
  }
  fire(type: string, event: Partial<FakeEvent>): void {
    const full: FakeEvent = { target: null, detail: 1, key: '', ...event };
    (this.listeners.get(type) ?? []).forEach((entry) => entry.listener(full));
  }
  listenerCount(): number {
    return [...this.listeners.values()].reduce((sum, entries) => sum + entries.length, 0);
  }
}

function setUp() {
  const menu = new FakeElement({ 'data-early-intent': 'menu' });
  const menuIcon = new FakeElement({}, menu);
  const account = new FakeElement({ 'data-early-intent': 'account' });
  const elsewhere = new FakeElement({});
  const document = new FakeDocument([menu, account]);
  const window: Record<string, unknown> = {};
  runInNewContext(EARLY_INTENT_SCRIPT, { document, window });
  return { menu, menuIcon, account, elsewhere, document, window };
}

describe('the early-tap script', () => {
  it('AC-10: a tap on a marked control makes it busy at once and records it', () => {
    const { menu, document, window } = setUp();
    document.fire('click', { target: menu });
    expect(menu.getAttribute('aria-busy')).toBe('true');
    expect(readEarlyIntent(window, 'menu')).toEqual({ id: 'menu', keyboard: false });
  });

  it('AC-10: a tap on something inside the marked control (its icon) counts as a tap on the control', () => {
    const { menu, menuIcon, document, window } = setUp();
    document.fire('click', { target: menuIcon });
    expect(menu.getAttribute('aria-busy')).toBe('true');
    expect(readEarlyIntent(window, 'menu')?.id).toBe('menu');
  });

  it('AC-10: Enter or Space on a button is a click without a pointer (detail 0) and is recorded as the keyboard', () => {
    const { account, document, window } = setUp();
    document.fire('click', { target: account, detail: 0 });
    expect(readEarlyIntent(window, 'account')).toEqual({ id: 'account', keyboard: true });
  });

  it('AC-10: an element without data-early-intent is ignored', () => {
    const { menu, elsewhere, document, window } = setUp();
    document.fire('click', { target: elsewhere });
    document.fire('click', { target: null });
    expect(menu.getAttribute('aria-busy')).toBeNull();
    expect(readEarlyIntent(window, 'menu')).toBeUndefined();
    expect(readEarlyIntent(window, 'account')).toBeUndefined();
  });

  it('AC-10: if both controls are tapped, the last one wins and the first returns to rest', () => {
    const { menu, account, document, window } = setUp();
    document.fire('click', { target: menu });
    document.fire('click', { target: account });
    expect(menu.getAttribute('aria-busy')).toBeNull();
    expect(account.getAttribute('aria-busy')).toBe('true');
    expect(readEarlyIntent(window, 'menu')).toBeUndefined();
    expect(readEarlyIntent(window, 'account')?.id).toBe('account');
  });

  it('AC-8: a second tap of the same control does nothing', () => {
    const { menu, document, window } = setUp();
    document.fire('click', { target: menu, detail: 0 });
    document.fire('click', { target: menu, detail: 1 });
    expect(menu.getAttribute('aria-busy')).toBe('true');
    expect(readEarlyIntent(window, 'menu')).toEqual({ id: 'menu', keyboard: true });
  });

  it('AC-10: Escape clears the pending state and the record; a later tap works again', () => {
    const { menu, document, window } = setUp();
    document.fire('click', { target: menu });
    document.fire('keydown', { key: 'a' });
    expect(menu.getAttribute('aria-busy')).toBe('true');
    document.fire('keydown', { key: 'Escape' });
    expect(menu.getAttribute('aria-busy')).toBeNull();
    expect(readEarlyIntent(window, 'menu')).toBeUndefined();
    document.fire('click', { target: menu });
    expect(readEarlyIntent(window, 'menu')?.id).toBe('menu');
  });

  it('AC-10: Escape with nothing pending does nothing', () => {
    const { document, window } = setUp();
    document.fire('keydown', { key: 'Escape' });
    expect(readEarlyIntent(window, 'menu')).toBeUndefined();
  });

  it('AC-10: after hydration the script stops listening and its record is removed', () => {
    const { menu, document, window } = setUp();
    expect(document.listenerCount()).toBe(2);
    document.fire('click', { target: menu });
    finishEarlyIntent(window);
    expect(document.listenerCount()).toBe(0);
    expect(EARLY_INTENT_GLOBAL in window).toBe(false);
    // A tap now belongs to React, not to the script.
    const account = new FakeElement({ 'data-early-intent': 'account' });
    document.fire('click', { target: account });
    expect(account.getAttribute('aria-busy')).toBeNull();
  });

  it('is small and reads no user data', () => {
    expect(EARLY_INTENT_SCRIPT.length).toBeLessThan(1_000);
    expect(EARLY_INTENT_SCRIPT).not.toMatch(/fetch|XMLHttpRequest|cookie|localStorage|sendBeacon/);
    expect(EARLY_INTENT_SCRIPT).not.toContain('</script');
  });
});

describe('reading the early tap', () => {
  it('AC-10: with no script (a client-side navigation, a test) there is nothing to read and finishing is harmless', () => {
    const host = {};
    expect(readEarlyIntent(host, 'menu')).toBeUndefined();
    expect(() => finishEarlyIntent(host)).not.toThrow();
  });

  it('AC-10: a record that is not shaped like the script\'s is ignored', () => {
    expect(readEarlyIntent({ [EARLY_INTENT_GLOBAL]: 'menu' }, 'menu')).toBeUndefined();
    expect(readEarlyIntent({ [EARLY_INTENT_GLOBAL]: { id: 'menu' } }, 'menu')).toBeUndefined();
    expect(readEarlyIntent({ [EARLY_INTENT_GLOBAL]: { id: 7, stop: () => undefined } }, 'menu')).toBeUndefined();
  });
});
