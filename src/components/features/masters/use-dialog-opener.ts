'use client';

import { useRef, useState } from 'react';

import { useFirstOpen, type FirstOpenOptions } from '@/components/shared/use-first-open';

import type { Opener } from './master-opener';

/**
 * The first-open loader of a masters screen's dialogs and what every such screen does around it (DL-150 (5), GitHub issue 245): the button that was
 * pressed (shown busy while the code loads, and the place focus returns to), and the rule that a second press while the first is loading does
 * nothing (UX spec 7.3.1 rule 11). The Process Master and the Materials tab each wrote this beside their own state for which dialog is open.
 * The code of the dialogs is fetched by `useFirstOpen` (architecture section 10, AQP-188); this adds nothing to it except the opener.
 */
export function useDialogOpener<Props>(options: FirstOpenOptions<Props>) {
  const [pressed, setPressed] = useState<Opener | null>(null);
  const opener = useRef<Opener | null>(null);
  const loader = useFirstOpen<Props>(options);

  /**
   * A button was pressed. Returns false and does nothing while the dialogs' code is loading: no second request, no second target. Otherwise it
   * remembers the opener, calls `prepare` (the screen sets which dialog is open and about what, in the same step), and asks the loader to open.
   */
  function press(from: Opener, byKeyboard: boolean, prepare: () => void): boolean {
    if (loader.pending) return false;
    opener.current = from;
    setPressed(from);
    prepare();
    loader.activate(byKeyboard);
    return true;
  }

  return { loader, pressed, opener, press };
}
