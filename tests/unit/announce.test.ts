import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ANNOUNCE_DELAY_MS, announce, CLEAR_AFTER_MS } from '@/components/features/estimate-ignore/announce';

/**
 * CR-01 item 7D, AQP-401 AC-8 and review finding QLT-03: the page's polite status is written after a short pause, is read, and is then cleared, so it cannot be found later on an unrelated page; one node, one timer.
 * No DOM here: a small stand-in for `document` and `window` holds the one region.
 */

interface Region {
  id: string;
  textContent: string;
  className: string;
  attributes: Record<string, string>;
  setAttribute: (name: string, value: string) => void;
}

let regions: Region[];

beforeEach(() => {
  vi.useFakeTimers();
  regions = [];
  const created: Region[] = [];
  vi.stubGlobal('document', {
    getElementById: (id: string) => regions.find((region) => region.id === id) ?? null,
    createElement: () => {
      const region: Region = {
        id: '',
        textContent: '',
        className: '',
        attributes: {},
        setAttribute(name, value) {
          this.attributes[name] = value;
        },
      };
      created.push(region);
      return region;
    },
    body: { appendChild: (region: Region) => regions.push(region) },
  });
  vi.stubGlobal('window', { setTimeout, clearTimeout });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the page announcer', () => {
  it('is one polite status node, empty at first, written after the pause, and cleared once it has been read', () => {
    announce('Q-1 ignored. It is now in the Ignored tab.');
    expect(regions).toHaveLength(1);
    expect(regions[0]?.attributes).toMatchObject({ role: 'status', 'aria-live': 'polite' });
    expect(regions[0]?.textContent).toBe('');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(regions[0]?.textContent).toBe('Q-1 ignored. It is now in the Ignored tab.');
    vi.advanceTimersByTime(CLEAR_AFTER_MS - 1);
    expect(regions[0]?.textContent).not.toBe('');
    vi.advanceTimersByTime(1);
    expect(regions[0]?.textContent).toBe('');
  });

  it('keeps one node and one timer for two quick calls: the last sentence wins and is the one that is cleared', () => {
    announce('First.');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS / 2);
    announce('Second.');
    expect(regions).toHaveLength(1);
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(regions[0]?.textContent).toBe('Second.');
    vi.advanceTimersByTime(CLEAR_AFTER_MS);
    expect(regions[0]?.textContent).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a new sentence after the first was written restarts the wait before the clear', () => {
    announce('First.');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS + CLEAR_AFTER_MS - 10);
    announce('Second.');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(regions[0]?.textContent).toBe('Second.');
    vi.advanceTimersByTime(CLEAR_AFTER_MS - 1);
    expect(regions[0]?.textContent).toBe('Second.');
    vi.advanceTimersByTime(1);
    expect(regions[0]?.textContent).toBe('');
  });
});
