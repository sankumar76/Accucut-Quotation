'use client';

import { useRef, useState } from 'react';

import { type BlockedPartView, withoutFilled } from '@/lib/estimates/calculate-missing';


/** Why the last press did not submit anything, in the server's words (a refusal with no list: a 409 such as "choose the customer"), or "it failed" (no usable answer came). */
export type CalculateProblem = { readonly kind: 'refused'; readonly message: string } | { readonly kind: 'failed' };

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
 * `filled(partId, inputs)` is told what a saved part now holds, so a part leaves the list as its last missing field is filled and the triangle in the tree goes with it.
 */
export function useCalculate({ estimateId, onSubmitted }: { readonly estimateId: string; readonly onSubmitted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<ReadonlyArray<BlockedPartView> | null>(null);
  const [problem, setProblem] = useState<CalculateProblem | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // Counts the blocked answers, so the summary takes focus once for each press and not again while the person fills the fields in.
  const [focusRequest, setFocusRequest] = useState(0);
  // A second press while the first is in flight must not send a second request, and state is read after the render, so the guard is a ref.
  const inFlight = useRef(false);

  async function calculate(): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    const client = await loadClient().catch(() => null);
    const outcome = client === null ? null : await client.calculateEstimate(estimateId);
    inFlight.current = false;
    setBusy(false);
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
      const parts = client.blockedPartsFrom(outcome);
      if (parts !== null && parts.length > 0) {
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

  return { busy, blocked, problem, done, focusRequest, calculate, filled };
}

export type CalculateState = ReturnType<typeof useCalculate>;
