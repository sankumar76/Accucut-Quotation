import type { KeyboardEvent, MouseEvent } from 'react';

/**
 * What a drop-down gets while the estimate may not be changed (CR-01 item 7D, AQP-401 AC-8; UX 12944 section 4: "they stay focusable so a keyboard or screen-reader user can still read every value, not `disabled`").
 * A native `<select>` has no `readonly`, so it is made one: `aria-readonly` says so, the list does not open on a press or a key (Tab still moves on), and the caller's `onChange` refuses a change that gets through
 * (a controlled value is put back by React in any case). `disabled` took the control out of the keyboard's reach and, in most browsers, out of the reading order of a screen reader.
 */
export function readOnlySelectProps(readOnly: boolean): {
  readonly 'aria-readonly'?: true;
  readonly onMouseDown?: (event: MouseEvent<HTMLSelectElement>) => void;
  readonly onKeyDown?: (event: KeyboardEvent<HTMLSelectElement>) => void;
} {
  if (!readOnly) return {};
  return {
    'aria-readonly': true,
    // A press does not open the list, but the control still takes focus from it (a click on the label does too).
    onMouseDown: (event) => {
      event.preventDefault();
      event.currentTarget.focus();
    },
    // Only the keys that would change or open the list are stopped; the browser's own shortcuts (F5, Ctrl or Cmd with R, F or L, Alt with the left and right arrows, Shift+F10) and Tab and Escape go through (AQP-401 QLT-01).
    onKeyDown: (event) => {
      if (changesAValue(event)) event.preventDefault();
    },
  };
}

/** The keys of a `<select>` that move its value or open its list (F4 opens it on Windows). */
const VALUE_KEYS: ReadonlySet<string> = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', ' ', 'Enter', 'F4']);

/** A key that would change the value or open the list: not one with Ctrl or Cmd (a shortcut of the browser), and Alt only for Alt+ArrowDown (which opens the list), so Alt+Left and Alt+Right (back and forward) stay. */
export function changesAValue(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>): boolean {
  if (event.ctrlKey || event.metaKey) return false;
  if (event.altKey) return event.key === 'ArrowDown' || event.key === 'ArrowUp';
  // A single character is a letter or digit that would jump to an option.
  return VALUE_KEYS.has(event.key) || event.key.length === 1;
}
