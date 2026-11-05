import { assertNever } from '../assert-never';

/**
 * State of a control that loads the code of its overlay the first time it is opened (AQP-188, architecture section 10,
 * UX spec section 7.3.1 rule 11). Pure: no React, no `import()`. The hook in `components/shared/use-first-open.ts`
 * owns the request and calls this to decide what happens next.
 *
 * Two facts are kept apart, because a person can change their mind while the code is on its way:
 *   - `phase`: where the code is. `idle` (never asked), `loading` (asked, not here yet), `ready` (here), `failed`
 *     (the request failed; the next activation asks again).
 *   - `wanted`: whether the person still wants the overlay open when the code arrives. Escape clears it, so the code may
 *     arrive but the panel stays closed (AQP-188 AC-8).
 * `shown` latches once the code is here and the person wanted it: the overlay is mounted from then on and stays mounted.
 */

export type FirstOpenPhase = 'idle' | 'loading' | 'ready' | 'failed';

export interface FirstOpenState {
  readonly phase: FirstOpenPhase;
  readonly wanted: boolean;
  readonly shown: boolean;
}

/**
 * What can happen to the control.
 *   - `activate`: pressed, by pointer, finger, Enter, Space or ArrowDown, or replayed from a tap made before the page was interactive.
 *   - `cancel`: Escape. Stops a pending open (the code may still arrive), or clears a failure.
 *   - `dismiss`: the page changed. Clears a failure and nothing else.
 *   - `loaded` and `failed`: the answer of the request.
 */
export type FirstOpenEvent = 'activate' | 'cancel' | 'dismiss' | 'loaded' | 'failed';

export const INITIAL_FIRST_OPEN: FirstOpenState = { phase: 'idle', wanted: false, shown: false };

function withShown(state: Omit<FirstOpenState, 'shown'> & { readonly shown: boolean }): FirstOpenState {
  return { ...state, shown: state.shown || (state.phase === 'ready' && state.wanted) };
}

/** The next state. Total: an event that means nothing in a state returns that same state (a double activation, say). */
export function reduceFirstOpen(state: FirstOpenState, event: FirstOpenEvent): FirstOpenState {
  switch (event) {
    case 'activate':
      if (state.phase === 'ready') return withShown({ ...state, wanted: true });
      if (state.phase === 'loading') return state.wanted ? state : { ...state, wanted: true };
      // idle or failed: ask for the code (again, after a failure).
      return { ...state, phase: 'loading', wanted: true };
    case 'cancel':
      if (state.phase === 'loading') return state.wanted ? { ...state, wanted: false } : state;
      if (state.phase === 'failed') return { ...state, phase: 'idle' };
      return state;
    case 'dismiss':
      return state.phase === 'failed' ? { ...state, phase: 'idle' } : state;
    case 'loaded':
      return state.phase === 'loading' ? withShown({ ...state, phase: 'ready' }) : state;
    case 'failed':
      return state.phase === 'loading' ? { ...state, phase: 'failed', wanted: false } : state;
    default:
      return assertNever(event, 'first-open event');
  }
}

/** The control waits for the code and the person still wants the overlay: it shows the pressed look and `aria-busy`. */
export function isFirstOpenPending(state: FirstOpenState): boolean {
  return state.phase === 'loading' && state.wanted;
}

/** The last request failed: the control shows its failure line. */
export function hasFirstOpenFailed(state: FirstOpenState): boolean {
  return state.phase === 'failed';
}

/** This change must send the request: the control went from not asked (or failed) to loading. */
export function shouldRequestCode(before: FirstOpenState, after: FirstOpenState): boolean {
  return before.phase !== 'loading' && after.phase === 'loading';
}

/** This change must open the overlay now: the code is here and the person wanted it, as a result of the event. */
export function shouldOpenOverlay(before: FirstOpenState, after: FirstOpenState, event: FirstOpenEvent): boolean {
  if (after.phase !== 'ready' || !after.wanted) return false;
  return event === 'activate' || (event === 'loaded' && before.phase === 'loading');
}
