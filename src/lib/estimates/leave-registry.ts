/**
 * The one place a way out of the estimate page asks "may I leave?" (STORY-05.08 AC-4). The page's guard (`leave-guard.tsx`, fetched after the page is up) registers itself here; anything that is
 * about to take the person away or drop what is on the form asks through `askToLeave`: choosing another part, and Sign out, which lives in the shell and knows nothing of estimates. With no guard
 * registered (any other page, or the guard's code not here yet) there is nothing unsaved to protect and the answer is yes at once. This file holds no React and no estimate, so the shell's account
 * panel can import it at no cost.
 */

export interface LeaveRequest {
  /** Runs when the person may go: nothing was unsaved, they saved a draft, or they chose to leave without saving. */
  readonly proceed: () => void;
  /** Runs when the person chose to stay (Keep editing, or Escape). */
  readonly cancel: () => void;
  /** True when going is a full page load (Sign out), which the browser would warn about a second time. The guard lets that one load through once the person has chosen. */
  readonly fullLoad?: boolean;
  /** True when going keeps the person on this page (a link to another row of it): the leave is over when `proceed` has run, so nothing is held back for it any longer (QLT-845-32). */
  readonly samePage?: boolean;
}

type Ask = (request: LeaveRequest) => void;

let ask: Ask | null = null;

/** The guard offers itself. Answers the way to withdraw it, which only withdraws this one (a newer guard stays). */
export function registerLeaveGuard(handler: Ask): () => void {
  ask = handler;
  return () => {
    if (ask === handler) ask = null;
  };
}

/** Asks the guard, or lets the person go when there is none. */
export function askToLeave(request: LeaveRequest): void {
  if (ask === null) request.proceed();
  else ask(request);
}

/** Resolves true when the person may go (and, if they were asked, said so), false when they chose to stay. For Sign out, which is a full page load. */
export function mayLeave(): Promise<boolean> {
  return new Promise((resolve) => askToLeave({ proceed: () => resolve(true), cancel: () => resolve(false), fullLoad: true }));
}
