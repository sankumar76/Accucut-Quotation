import type { SaveGate } from './save-gate';

/**
 * Goes ahead with a way out once the review's refresh of the page is not in flight, or after `maxMs` (DL-491 (c), QLT-845-23). A refresh whose fetch is half way when the guard's `go(-n)` lands is cancelled by some
 * engines, and Next's answer to that is a hard navigation to the address the page had, which overrides the way out. The wait is capped: failing the cap can only cause a wrong landing, never lost text (the person's
 * choice was made, and what is unsaved was saved or given up before this runs). `onWaiting` tells the dialog to show its busy state meanwhile.
 */
export async function proceedAfterRefresh(gate: SaveGate, proceed: () => void, maxMs: number, onWaiting: (waiting: boolean) => void = () => undefined): Promise<void> {
  if (gate.isRefreshing()) {
    onWaiting(true);
    await gate.refreshEnded(maxMs);
    onWaiting(false);
  }
  proceed();
}
