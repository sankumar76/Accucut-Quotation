/**
 * Which button opened a dialog on SCR-14, so focus can return to it when the dialog closes, and so the button can show that
 * its dialog is still loading (UX spec 7.3.1 rule 11). Types and one lookup; nothing here is a component.
 */

export type DialogKind = 'add' | 'edit' | 'reset' | 'deactivate';

export interface Opener {
  /** The person whose row the button is in, or null for "Add user". */
  readonly userId: string | null;
  /** The button's `data-action`; `deactivate` and `activate` are one place that changes its name. */
  readonly action: string;
}

const TOGGLE_ACTIONS: ReadonlyArray<string> = ['deactivate', 'activate'];

/** Does this button belong to the opener? A row has a table button and a card button, and only one of them is shown. */
export function isOpener(opener: Opener | null, userId: string | null, action: string): boolean {
  if (opener === null || opener.userId !== userId) return false;
  const actions = TOGGLE_ACTIONS.includes(opener.action) ? TOGGLE_ACTIONS : [opener.action];
  return actions.includes(action);
}

/** The first button the person can see for an opener, or null (a hidden or disabled one cannot take focus). */
export function findOpenerElement(opener: Opener): HTMLElement | null {
  const actions = TOGGLE_ACTIONS.includes(opener.action) ? TOGGLE_ACTIONS : [opener.action];
  const scope = opener.userId === null ? 'main' : `main [data-user-id="${CSS.escape(opener.userId)}"]`;
  const candidates = document.querySelectorAll<HTMLElement>(actions.map((action) => `${scope} [data-action="${action}"]`).join(', '));
  return Array.from(candidates).find((element) => element.getClientRects().length > 0 && !(element instanceof HTMLButtonElement && element.disabled)) ?? null;
}
