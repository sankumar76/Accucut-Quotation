import { useEffect, useState } from 'react';

/**
 * True once `active` has been true for `delayMs` without a break. The loading skeleton uses it (UX spec section 6.0 "States": shown
 * after 300 ms): an answer that arrives sooner never flashes a skeleton, and until then the list that was there stays on screen.
 */
export function useAfterDelay(active: boolean, delayMs: number): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setTimeout(() => setElapsed(true), delayMs);
    return () => {
      window.clearTimeout(timer);
      setElapsed(false);
    };
  }, [active, delayMs]);

  return active && elapsed;
}
