import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { controlIdFor, NEXT_FIELD, PART_FORM_ATTRIBUTE, PART_FORM_TITLE_ID } from '@/components/features/estimate-workspace/field-ids';
import { focusFieldWhenPresent, focusFirstField, focusFormTitleWhenPresent, MAX_ATTEMPTS, RETRY_MILLISECONDS } from '@/components/features/estimate-workspace/focus-field';

/**
 * AQP-339 AC-5: Enter on a part puts focus on the first field that can be typed into, and when the fields' code arrives after the key press (`PartFields` is fetched after the page is up) it still
 * lands there, waiting and giving up quietly after about two seconds. The document is a stand-in with the one method the helpers use, so the test runs with no browser; the browser path (three
 * widths) is `tests/e2e/estimate-form.spec.ts` and `tests/e2e/estimate-tree.spec.ts`.
 */

interface FakeControl {
  focus: () => void;
  matches: (selector: string) => boolean;
}

const FIRST_FIELD_SELECTOR = `[${PART_FORM_ATTRIBUTE}] ${NEXT_FIELD}`;
const PART_ID = 'part-1';
const FIELD_ID = 'part-name';

let present: FakeControl | null = null;
let queries: string[] = [];

const control = (focused: string[], name: string, disabled = false): FakeControl => ({
  focus: () => focused.push(name),
  matches: (selector) => disabled && selector === ':disabled',
});

beforeEach(() => {
  present = null;
  queries = [];
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout: (callback: () => void, ms: number) => setTimeout(callback, ms) });
  vi.stubGlobal('CSS', { escape: (value: string) => value });
  vi.stubGlobal('document', {
    querySelector: (selector: string) => {
      queries.push(selector);
      if (selector === FIRST_FIELD_SELECTOR) return present;
      // The form of one part, with the control of one field inside it.
      return present === null ? null : { querySelector: (inner: string) => (inner === `#${controlIdFor(FIELD_ID)}` ? present : null) };
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('focusFirstField (AQP-339 AC-5)', () => {
  it('focuses the first typeable field at once when the form is on the page', () => {
    const focused: string[] = [];
    present = control(focused, 'first');
    focusFirstField();
    expect(focused).toEqual(['first']);
    expect(queries).toEqual([FIRST_FIELD_SELECTOR]);
  });

  it('waits for the fields when their code arrives after the key press, then focuses the first one once', () => {
    const focused: string[] = [];
    focusFirstField();
    vi.advanceTimersByTime(RETRY_MILLISECONDS * 5);
    expect(focused).toEqual([]);
    present = control(focused, 'first');
    vi.advanceTimersByTime(RETRY_MILLISECONDS);
    expect(focused).toEqual(['first']);
    vi.advanceTimersByTime(RETRY_MILLISECONDS * MAX_ATTEMPTS);
    expect(focused).toEqual(['first']);
  });

  it('gives up quietly after about two seconds when the fields never arrive', () => {
    const focused: string[] = [];
    expect(() => focusFirstField()).not.toThrow();
    vi.advanceTimersByTime(RETRY_MILLISECONDS * MAX_ATTEMPTS * 2);
    expect(queries).toHaveLength(MAX_ATTEMPTS);
    expect(RETRY_MILLISECONDS * MAX_ATTEMPTS).toBe(2000);
    present = control(focused, 'late');
    vi.advanceTimersByTime(RETRY_MILLISECONDS * 10);
    expect(focused).toEqual([]);
  });
});

describe('focusFieldWhenPresent (STORY-05.09, unchanged by AQP-339)', () => {
  it('focuses the field inside the form of the part once it is there', () => {
    const focused: string[] = [];
    focusFieldWhenPresent(PART_ID, FIELD_ID);
    expect(focused).toEqual([]);
    present = control(focused, 'field');
    vi.advanceTimersByTime(RETRY_MILLISECONDS);
    expect(focused).toEqual(['field']);
  });

  it('skips a disabled control and keeps waiting', () => {
    const focused: string[] = [];
    present = control(focused, 'field', true);
    focusFieldWhenPresent(PART_ID, FIELD_ID);
    vi.advanceTimersByTime(RETRY_MILLISECONDS * 3);
    expect(focused).toEqual([]);
    present = control(focused, 'enabled');
    vi.advanceTimersByTime(RETRY_MILLISECONDS);
    expect(focused).toEqual(['enabled']);
  });
});

/** An element with the focus that lies inside one layer (a role and a data-state), answering `closest` the way the browser does for a list of `[role="x"]` and `[role="x"][data-state="y"]` selectors. */
const insideLayer = (role: string, state: string): { closest: (selector: string) => object | null } => ({
  closest: (selector) =>
    selector.split(',').some((part) => {
      const found = /^\[role="(\w+)"\](?:\[data-state="(\w+)"\])?$/.exec(part.trim());
      return found !== null && found[1] === role && (found[2] === undefined || found[2] === state);
    })
      ? {}
      : null,
});

describe('focusFormTitleWhenPresent (AQP-490, DEF-133)', () => {
  const TITLE_SELECTOR = `[${PART_FORM_ATTRIBUTE}][data-part-id="${PART_ID}"] #${PART_FORM_TITLE_ID}`;

  beforeEach(() => {
    vi.stubGlobal('document', {
      querySelector: (selector: string) => {
        queries.push(selector);
        return selector === TITLE_SELECTOR ? present : null;
      },
    });
  });

  it('focuses the title of the form of this part, never a field, once the form is on the page', () => {
    const focused: string[] = [];
    present = control(focused, 'title');
    focusFormTitleWhenPresent(PART_ID);
    expect(focused).toEqual(['title']);
    expect(queries).toEqual([TITLE_SELECTOR]);
  });

  it('looks inside the form of this part only (data-part-id), so the title of the form that was open before is not taken', () => {
    focusFormTitleWhenPresent(PART_ID);
    expect(queries.every((query) => query === TITLE_SELECTOR)).toBe(true);
  });

  it('does not take the focus from a menu or a dialog the person has opened since (the drawer opened again, the "+" menu of a row): it stops looking at once', () => {
    const focused: string[] = [];
    present = control(focused, 'title');
    vi.stubGlobal('document', {
      activeElement: insideLayer('menu', 'open'),
      querySelector: (selector: string) => {
        queries.push(selector);
        return selector === TITLE_SELECTOR ? present : null;
      },
    });
    focusFormTitleWhenPresent(PART_ID);
    vi.advanceTimersByTime(RETRY_MILLISECONDS * MAX_ATTEMPTS * 2);
    expect(focused).toEqual([]);
    expect(queries).toEqual([]);
  });

  it('focus still inside the closing drawer: the title takes the focus (only an OPEN menu or dialog is a place the person moved on to)', () => {
    const focused: string[] = [];
    present = control(focused, 'title');
    // The drawer that the tap is closing: a dialog whose state is already "closed". The selector must not find it.
    vi.stubGlobal('document', {
      activeElement: insideLayer('dialog', 'closed'),
      querySelector: (selector: string) => (selector === TITLE_SELECTOR ? present : null),
    });
    focusFormTitleWhenPresent(PART_ID);
    expect(focused).toEqual(['title']);
  });

  it('still takes the focus when it is on the page or on something that is not in a menu or a dialog', () => {
    const focused: string[] = [];
    present = control(focused, 'title');
    vi.stubGlobal('document', {
      activeElement: { closest: () => null },
      querySelector: (selector: string) => (selector === TITLE_SELECTOR ? present : null),
    });
    focusFormTitleWhenPresent(PART_ID);
    expect(focused).toEqual(['title']);
  });

  it('waits for the form, as the field helpers do, then focuses the title once, and gives up quietly after about two seconds', () => {
    const focused: string[] = [];
    focusFormTitleWhenPresent(PART_ID);
    vi.advanceTimersByTime(RETRY_MILLISECONDS * 3);
    present = control(focused, 'title');
    vi.advanceTimersByTime(RETRY_MILLISECONDS * 3);
    expect(focused).toEqual(['title']);
    queries = [];
    present = null;
    focusFormTitleWhenPresent(PART_ID);
    vi.advanceTimersByTime(RETRY_MILLISECONDS * MAX_ATTEMPTS * 2);
    expect(queries).toHaveLength(MAX_ATTEMPTS);
  });
});
