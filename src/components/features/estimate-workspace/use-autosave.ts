'use client';

import { useEffect, useRef } from 'react';

import type { SaveGate } from '@/lib/estimates/save-gate';
import { MILLISECONDS_PER_SECOND } from '@/lib/time';

/** The fixed tick of the automatic save (FR-054, STORY-05.10 A-1): 30 seconds while the estimate is open, not 30 seconds after the last keystroke. */
export const AUTOSAVE_INTERVAL_SECONDS = 30;
export const AUTOSAVE_INTERVAL_MS = AUTOSAVE_INTERVAL_SECONDS * MILLISECONDS_PER_SECOND;

export interface UseAutosaveOptions {
  /** False once the Engineer may no longer change the inputs (`canEditInputs`): no timer runs. */
  readonly enabled: boolean;
  /** The tick, in milliseconds; a test sets its own. */
  readonly intervalMs?: number;
  /** The tab is hidden: nothing runs (a browser slows a hidden tab's timers anyway, and a person who is not looking is not typing). */
  readonly isHidden?: () => boolean;
  /** Something else is on its way that must not be raced: Calculate in flight (STORY-05.10 AC-7). */
  readonly isBlocked?: () => boolean;
}

const documentIsHidden = (): boolean => typeof document !== 'undefined' && document.visibilityState === 'hidden';

/**
 * The 30-second save of the estimate page (STORY-05.10): one timer for the whole page, not one per part. It is **not a second save path**. A tick asks the part forms that offered a way to send again
 * what they show (`gate.flush('auto')`), and each saves through its own save, the one leaving a field uses; what the tick adds is only when to ask, and the three rules of when not to:
 * - nothing is unsaved: nothing is asked, so no request is made and no figure is cleared by a save that changed nothing (AC-2);
 * - a save is in flight, Calculate is in flight, or the tab is hidden: the tick is skipped and never queued (AC-7); the next tick asks again;
 * - the person may not edit the inputs, or the page is left: no timer at all, and the timer is cleared on leaving (AC-7).
 * Calculate and Save draft wait on the same gate, so they never see a state older than the screen (AC-8).
 */
export function useAutosave(gate: SaveGate, { enabled, intervalMs = AUTOSAVE_INTERVAL_MS, isHidden = documentIsHidden, isBlocked }: UseAutosaveOptions): void {
  // The latest answers, read when a tick runs, so a changing function does not restart the timer (and with it, the 30 seconds).
  const hidden = useRef(isHidden);
  const blocked = useRef(isBlocked);
  useEffect(() => {
    hidden.current = isHidden;
    blocked.current = isBlocked;
  });

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (hidden.current() || blocked.current?.() === true || gate.isSaving() || !gate.isDirty()) return;
      gate.flush('auto');
    }, intervalMs);
    return () => clearInterval(timer);
  }, [gate, enabled, intervalMs]);
}
