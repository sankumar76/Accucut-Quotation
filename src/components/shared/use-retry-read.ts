'use client';

import { useRouter } from 'next/navigation';
import { startTransition } from 'react';

/**
 * The "Try again" of a route-level `error.tsx` (DEF-033, AQP-287): asks the server for the route again, then resets the boundary. `reset` alone only draws
 * the boundary's children again from the answer the client already holds, and for a page that failed while the server rendered it that answer is the failed
 * one, so the error stayed on the screen after the read worked again. `router.refresh()` and `reset()` go in one transition, the order the Next.js
 * documentation gives for an error boundary.
 *
 * Every `error.tsx` takes its button's handler from here (`RouteLoadError` for the data screens, `app/error.tsx` for the root page), and
 * `tests/unit/route-error-retry.test.ts` walks every `error.tsx` so that a new one cannot hand `reset` to its button.
 *
 * This file is part of the first load of every page (`app/error.tsx` imports it): it imports only `next/navigation` and `react` (NFR-009).
 */
export function useRetryRead(reset: () => void): () => void {
  const router = useRouter();
  return () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };
}
