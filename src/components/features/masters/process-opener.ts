/**
 * Which button opened a dialog on SCR-11, so focus can return to it when the dialog closes, and so the button can show that its
 * dialog is still loading (UX spec 7.3.1 rule 11). Types and one lookup; nothing here is a component.
 */

export type DialogKind = 'add' | 'edit' | 'delete' | 'blocked';

export interface Opener {
  /** The rate whose row the button is in, or null for "Add rate". */
  readonly itemId: string | null;
  /** The button's `data-action`: `add`, `edit` or `delete`. */
  readonly action: string;
}

/** Does this button belong to the opener? A row has a table button and a card button, and only one of them is shown. */
export function isOpener(opener: Opener | null, itemId: string | null, action: string): boolean {
  return opener !== null && opener.itemId === itemId && opener.action === action;
}

/** The first button the person can see for an opener, or null (a hidden or disabled one cannot take focus). */
export function findOpenerElement(opener: Opener): HTMLElement | null {
  const scope = opener.itemId === null ? 'main' : `main [data-item-id="${CSS.escape(opener.itemId)}"]`;
  const candidates = document.querySelectorAll<HTMLElement>(`${scope} [data-action="${CSS.escape(opener.action)}"]`);
  return Array.from(candidates).find((element) => element.getClientRects().length > 0 && !(element instanceof HTMLButtonElement && element.disabled)) ?? null;
}
