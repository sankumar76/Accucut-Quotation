import { useEffect, useState, useSyncExternalStore } from 'react';

import type { SaveGate } from '@/lib/estimates/save-gate';

/** A hold shorter than this shows nothing and says nothing (UX ruling on AQP-506, as for the Loading row); from here on the fields look read-only and one polite line is said. */
export const INPUT_HELD_SHOWN_AFTER_MS = 300;

export interface InputHeld {
  /** The fields do not accept input (`readonly` and `aria-readonly`, never `disabled` or `inert`; `aria-busy` on the form): from the frame the guard says so, to the frame it says otherwise. */
  readonly held: boolean;
  /** The hold has lasted `INPUT_HELD_SHOWN_AFTER_MS` or more: the shaded read-only look and the polite line come now, not before. */
  readonly shown: boolean;
  /** A write has been owed for `INPUT_HELD_MAX_MS` and the fields are still held (DL-489): the notice with "Stay on this row" is drawn, and the polite line gives way to it. */
  readonly tooLong: boolean;
}

/** What the leave guard says about the form's fields (DL-488 (iv)), read from the gate the guard and the form share. */
export function useInputHeld(gate: SaveGate): InputHeld {
  const held = useSyncExternalStore(gate.subscribeInputHeld, gate.isInputHeld, () => false);
  const tooLong = useSyncExternalStore(gate.subscribeInputHeld, gate.isHoldTooLong, () => false);
  const [lasted, setLasted] = useState(false);
  useEffect(() => {
    if (!held) return;
    const timer = setTimeout(() => setLasted(true), INPUT_HELD_SHOWN_AFTER_MS);
    return () => {
      clearTimeout(timer);
      setLasted(false);
    };
  }, [held]);
  return { held, shown: held && lasted, tooLong: held && tooLong };
}
