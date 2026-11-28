import type { LeaveRequest } from './leave-registry';
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

/**
 * The leave flag lasts for one leave only (DL-491 addendum (7), QLT-845-32): a way out that keeps the person on this page (a link to another row) clears it once it has been sent, and the review's refresh runs what it
 * owed. A way out that takes them away keeps it set while the traversal is in flight, so no refresh starts meanwhile, not even one a save that was in flight asks for as it answers (QLT-845-34), and what was owed is
 * dropped. It is cleared when the guard goes (`holdGateForGuard`), or when the guard sees the person is still on this page (a landing or a commit of this page, or a click), in case the way out did not go anywhere.
 */
export function afterLeaveChosen(gate: SaveGate, request: LeaveRequest): void {
  if (request.samePage === true) gate.setLeaving(false);
  else gate.setLeaving(true, true);
}

/**
 * A guard takes the gate for as long as it is on the page and gives it back clear (QLT-845-32): the Lead's review gate is one object for the whole session, so a flag a former page left set would hold the next review's
 * refresh back for good (the tiles and the tree would keep figures that are no longer current). Answers the way to give it back.
 */
export function holdGateForGuard(gate: SaveGate): () => void {
  gate.setLeaving(false);
  return () => gate.setLeaving(false);
}
