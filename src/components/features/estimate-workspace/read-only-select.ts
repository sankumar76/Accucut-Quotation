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
    // Every key but the ones that move on or away leaves the value alone: the arrows, Space, Enter and letters would change or open it.
    onKeyDown: (event) => {
      if (event.key !== 'Tab' && event.key !== 'Escape') event.preventDefault();
    },
  };
}
