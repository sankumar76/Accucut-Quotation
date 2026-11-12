'use client';

import { useCallback, useEffect, useRef } from 'react';

import { focusHeading, focusOpener, type Opener } from './master-opener';

/**
 * Reading a masters list again after a change, and where focus goes when that read has finished: back to the button that opened the dialog,
 * or to the page heading when that button is gone (a deleted row, ux-spec v0.17). If the list cannot be read, the load error takes focus
 * (`MasterLoadError`, DEF-020) and this does not move it. The one place SCR-11 and the three tabs of SCR-13 do this.
 */

export type ReadStatus = 'loading' | 'ready' | 'error';

/** The button to return focus to. A ref, because the dialog remembers its opener there; a screen with one fixed button passes a constant of the same shape. */
export type OpenerRef = { readonly current: Opener | null };

export interface FocusAfterReadInputs {
  readonly status: ReadStatus;
  /** What the read returned (the list, the pair of rates): when it changes, a read that settled in the meantime is looked at again. */
  readonly result: unknown;
  readonly opener: OpenerRef;
  /**
   * Also call `focusOpener` when the read failed, with `listFailed` set: that does nothing while focus is on the page (the load error holds it)
   * and returns focus to the opener or the heading when it was lost to `<body>`. Off by default.
   */
  readonly shouldFocusWhenFailed?: boolean | undefined;
}

/**
 * Remembers that a read was asked for with focus to return, and returns it once that read has settled. Returns the function that asks.
 * The request is spent by the first settled read, so a later read that nobody asked focus for moves nothing.
 */
export function useFocusAfterRead({ status, result, opener, shouldFocusWhenFailed = false }: FocusAfterReadInputs): (returnFocus: boolean) => void {
  const wantsFocus = useRef(false);

  useEffect(() => {
    if (status === 'loading' || !wantsFocus.current) return;
    wantsFocus.current = false;
    if (status === 'ready') focusHeading(); // CONTROL A2: after a good read focus goes to the heading, not the opener
    else if (shouldFocusWhenFailed) focusOpener(opener.current, true);
  }, [status, result, opener, shouldFocusWhenFailed]);

  return useCallback((returnFocus: boolean): void => {
    wantsFocus.current = returnFocus;
  }, []);
}

export interface ReadAgainInputs extends Omit<FocusAfterReadInputs, 'shouldFocusWhenFailed'> {
  /** Reads the list again and settles the status. */
  readonly refresh: () => Promise<void>;
}

/** The "read again" of a list whose status is held elsewhere: asks for focus to return, then reads. Pass `true` after a change a person made, `false` for Try again. */
export function useReadAgain({ refresh, ...focus }: ReadAgainInputs): (returnFocus: boolean) => Promise<void> {
  const askForFocus = useFocusAfterRead(focus);
  return useCallback(
    async (returnFocus: boolean): Promise<void> => {
      askForFocus(returnFocus);
      await refresh();
    },
    [askForFocus, refresh],
  );
}
