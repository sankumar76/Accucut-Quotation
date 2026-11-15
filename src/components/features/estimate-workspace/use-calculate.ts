'use client';

import { useRef, useState } from 'react';

import type { AckRequestView } from '@/lib/estimates/calculate-client';
import { type BlockedPartView, withoutFilled } from '@/lib/estimates/calculate-missing';


/**
 * Why the last press did not submit anything: in the server's words (a refusal with no list: a 409 such as "choose the customer"), "it failed" (no usable answer came), or "unsaved" (a field
 * shows a value that is not saved, so nothing was sent: the form says which, under the field).
 */
export type CalculateProblem = { readonly kind: 'refused'; readonly message: string } | { readonly kind: 'failed' } | { readonly kind: 'unsaved' };

/**
 * The code that sends Calculate and reads its answers is fetched when the button is first pressed, by a bare `import()` (NFR-009: `/estimates/[code]` has no room left in its 200 KB first load, and
 * nobody needs this code before the first press). A fetch that fails is the same "it failed" as a network that fails, and the next press tries again.
 */
const loadClient = () => import('@/lib/estimates/calculate-client');

/** The code of the 409 for an estimate that was already submitted (`TRANSITION_REFUSALS.ALREADY_SUBMITTED`, written here so the state machine's table is not carried for one string). */
const ALREADY_SUBMITTED_CODE = 'ESTIMATE_ALREADY_SUBMITTED';

/**
 * What Calculate does on SCR-05 (STORY-05.09 AC-1, AC-2, AC-7; UX spec SCR-05 "Calculate blocked", "Submitted"). One press is one request, and a press while one is in flight is ignored (a double
 * click is one request, and the server answers a second with a 409 and makes no second calculation). A good answer is the status and the fixed sentence: `onSubmitted` runs, and the screen
 * shows the sentence and no number (there is none to show). A blocked one is the list of parts and fields the server named: it is kept as client state only (architecture A-16; after a reload
 * the part simply shows "Some inputs entered"). **Nothing is submitted on the screen's own judgement**: the missing list is the server's.
 *
 * **The saves come first** (review SQR-01 of AQP-317): a press follows the leaving of a field at once, and the part form's save of it is queued behind others. The press waits for `settle()` (the
 * saves in flight, `save-gate.ts`) while the button shows "Calculating", so the record holds what the screen shows; and nothing is sent while a field shows a value that is not saved.
 *
 * `filled(partId, inputs)` is told what a saved part now holds, so a part leaves the list as its last missing field is filled and the triangle in the tree goes with it.
 */
export function useCalculate({ estimateId, onSubmitted, settle }: { readonly estimateId: string; readonly onSubmitted: () => void; readonly settle: () => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<ReadonlyArray<BlockedPartView> | null>(null);
  const [problem, setProblem] = useState<CalculateProblem | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // The 409 of a 0 in QTY per Assy: the rows and the revision to send back, while the dialog is open. Client state only, never stored.
  const [warning, setWarning] = useState<(AckRequestView & { readonly changed: boolean }) | null>(null);
  // Counts the blocked answers, so the summary takes focus once for each press and not again while the person fills the fields in.
  const [focusRequest, setFocusRequest] = useState(0);
  // A second press while the first is in flight must not send a second request, and state is read after the render, so the guard is a ref.
  const inFlight = useRef(false);

  /** `acknowledged` is the revision of the 409 the person chose to go ahead past ("Calculate anyway"); a first press sends none. */
  async function calculate(acknowledged?: number): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    if (!(await settle())) {
      inFlight.current = false;
      setBusy(false);
      setProblem({ kind: 'unsaved' });
      return;
    }
    const client = await loadClient().catch(() => null);
    const outcome = client === null ? null : acknowledged === undefined ? await client.calculateEstimate(estimateId) : await client.calculateAnyway(estimateId, acknowledged);
    inFlight.current = false;
    setBusy(false);
    // Whatever the answer, the dialog of the last 409 is closed, unless this answer is a new one (below).
    setWarning(null);
    if (client === null || outcome === null || outcome.status === 'failed') {
      setProblem({ kind: 'failed' });
    } else if (outcome.status === 'ok') {
      setBlocked(null);
      setDone(outcome.value.message);
      onSubmitted();
    } else if (outcome.code === ALREADY_SUBMITTED_CODE) {
      // Another tab (or an earlier press whose answer was lost) already submitted it: the estimate is submitted, so the screen shows it as that, in the server's words.
      setDone(outcome.title);
      onSubmitted();
    } else {
      const ask = client.warningFrom(outcome);
      const parts = client.blockedPartsFrom(outcome);
      if (ask !== null) {
        // A 0 in QTY per Assy: nothing was calculated and the person is asked. After "Calculate anyway" this is a new list (something changed in between), and the dialog says so.
        setWarning({ ...ask, changed: acknowledged !== undefined });
      } else if (parts !== null && parts.length > 0) {
        setBlocked(parts);
        setFocusRequest((count) => count + 1);
      } else {
        setProblem({ kind: 'refused', message: outcome.title });
      }
    }
  }

  /** A part was saved: the fields of it that now hold a value are no longer missing, and a part with none left is no longer listed. */
  function filled(partId: string, inputs: Readonly<Record<string, string>>): void {
    setBlocked((current) => (current === null ? current : withoutFilled(current, partId, inputs)));
  }

  return { busy, blocked, problem, done, focusRequest, calculate, filled, warning, closeWarning: () => setWarning(null) };
}

export type CalculateState = ReturnType<typeof useCalculate>;
