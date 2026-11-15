'use client';

import { useEffect, useState, type ComponentType } from 'react';

interface LazyState<Props> {
  readonly Component: ComponentType<Props> | null;
  readonly failed: boolean;
}

/**
 * Fetches a component's code after the page is up, by a bare `import()` (NFR-009: `/estimates/[code]` is held to 200 KB of first-load JavaScript, and this page has no room left in it, so what
 * nobody needs before the first press leaves the first load). The code is asked for as soon as the page has mounted, so it is normally here long before it is needed, and it is not in the scripts
 * the page names. `Component` is `null` until it arrives, and `failed` says the fetch did not come (the caller shows a plain fallback). A fetch that fails is asked for again when `needed` turns true (the person is waiting for it), not in a loop. It is not `React.lazy` or
 * `next/dynamic`, for the same reason as the overlay loader (`use-first-open.ts`): a rejected lazy component cannot be tried again.
 */
export function useLazyComponent<Props>(load: () => Promise<ComponentType<Props>>, needed: boolean): { readonly Component: ComponentType<Props> | null; readonly failed: boolean } {
  const [state, setState] = useState<LazyState<Props>>({ Component: null, failed: false });
  useEffect(() => {
    if (state.Component !== null || (state.failed && !needed)) return;
    let live = true;
    void load().then(
      (Component) => {
        if (live) setState({ Component, failed: false });
      },
      () => {
        if (live) setState((current) => (current.failed ? current : { Component: null, failed: true }));
      },
    );
    return () => {
      live = false;
    };
  }, [state, needed, load]);
  return { Component: state.Component, failed: state.failed };
}
