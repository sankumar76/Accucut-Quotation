'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';

import { CALCULATED_LINE_ID } from './recalculate-ids';

/**
 * The Calculate or Recalculate button of SCR-06 (STORY-06.04 AC-3, AC-5, AC-9; UX spec SCR-06 "Total cleared", "Loading", "Error"): the one piece of the review that is a script. It is the **only** client
 * component the review draws, and it is as small as it can be (NFR-009, ADR-016: `/estimates/[code]` has no room to spare in its first load): the button, a line for a screen reader, and the notice of a refusal.
 * The code that sends the request and reads the answer (`recalculate-client.ts`) is fetched by a bare `import()` when the button is **first pressed**, so the page does not carry it.
 *
 * **It decides nothing.** One press is one request, and a press while one is in flight is ignored (a double click is one request). Who may press, whether the estimate is approved, which inputs are missing and
 * whether a quantity warning applies are the server's; a refusal is shown in the server's own sentence. **No figure passes through here** (NFR-002): after a good press, and after an answer that was lost, the
 * page is drawn again by the server (`router.refresh()`), so whatever the figures are, they reach the screen the way they always do, through the figure state.
 *
 * While the press and the refresh are under way the button is `aria-busy` (it stays enabled and keeps focus, as the pressed rule of UX section 7.3.1 asks), a polite line says so, and the tiles of the review
 * show their skeleton by CSS (`figure-tiles.tsx` finds the busy button with `:has()`). When the figures are current again this button is no longer drawn; focus goes to the "Calculated ..." line, so it is not lost.
 */

/** Fetched on the first press only (NFR-009). A fetch that fails is the same "no answer" as a network that fails, and the next press tries again. */
const loadClient = () => import('@/lib/estimates/recalculate-client');

/** A 409 may mean the estimate moved on in another tab (approved, unlocked), so the page is drawn again to show it as it is now. */
const CONFLICT = 409;

export interface RecalculateButtonProps {
  readonly id: string;
  readonly estimateId: string;
  /** "Calculate" for an estimate that was never calculated, "Recalculate" for one whose figures are cleared. */
  readonly label: string;
  /** What a screen reader hears, and a sighted person reads, while the press is under way. */
  readonly busyLine: string;
  /** The sentence when no usable answer came. */
  readonly failedLine: string;
}

export function RecalculateButton({ id, estimateId, label, busyLine, failedLine }: RecalculateButtonProps) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  // A second press while the first is in flight must not send a second request, and state is read after the render, so the guard is a ref.
  const inFlight = useRef(false);
  const worked = useRef(false);

  // The button leaves the page when the figures come back, taking focus with it: hand it to the line that says when they were calculated.
  useEffect(
    () => () => {
      if (worked.current) document.getElementById(CALCULATED_LINE_ID)?.focus();
    },
    [],
  );

  async function press(): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setProblem(null);
    const client = await loadClient().catch(() => null);
    const outcome = client === null ? null : await client.recalculateEstimate(estimateId);
    inFlight.current = false;
    setSending(false);
    worked.current = outcome !== null && outcome.status === 'ok';
    if (outcome !== null && outcome.status === 'refused') setProblem(outcome.title);
    else if (!worked.current) setProblem(failedLine);
    if (worked.current || outcome === null || outcome.status === 'failed' || (outcome.status === 'refused' && outcome.httpStatus === CONFLICT)) {
      startRefresh(() => router.refresh());
    }
  }

  const busy = sending || refreshing;
  return (
    <>
      <Button id={id} aria-busy={busy} onClick={() => void press()} className="w-full md:w-auto">
        {label}
      </Button>
      <p aria-live="polite" className={busy ? 'text-label text-ink-2' : 'sr-only'}>
        {busy ? busyLine : ''}
      </p>
      {problem === null ? null : <Notice tone="danger">{problem}</Notice>}
    </>
  );
}
