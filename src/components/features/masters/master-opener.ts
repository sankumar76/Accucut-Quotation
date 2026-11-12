/**
 * Which button opened a dialog on a masters screen (SCR-11 and SCR-13), so focus can return to it when the dialog closes, and so the
 * button can show that its dialog is still loading (UX spec 7.3.1 rule 11). Types and lookups; nothing here is a component.
 */

export interface Opener {
  /** The item (rate, material or treatment) whose row the button is in, or null for an Add button. */
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

/** The page heading (`h1`, `tabindex="-1"`): where focus goes when the button that opened a dialog is gone (ux-spec v0.17, QLT-06). */
export function focusHeading(): void {
  document.querySelector<HTMLElement>('main h1')?.focus();
}

/** Is focus on a live element of the page, and not lost to `<body>` because the dialog that held it has gone? */
function focusIsOnPage(): boolean {
  const active = document.activeElement;
  return active !== null && active !== document.body;
}

/**
 * Returns focus to the button that opened a dialog; when that button no longer exists (its rate is gone), to the page heading.
 * When the list could not be read again after a saved change (`listFailed`), the load error owns focus (it takes it on mount, UX spec
 * SCR-11 and SCR-13 "Error (load)"): the dialog's close handler runs after that and must not take it away (DEF-020). But if the dialog
 * itself held focus while the list was in error (Add opened from the error state and cancelled, or a refusal whose re-read failed
 * while it was open), nothing holds it now, so focus returns to the opener or the heading as it does without an error (QLT-01).
 */
export function focusOpener(opener: Opener | null, listFailed = false): void {
  if (listFailed && focusIsOnPage()) return;
  const button = opener === null ? null : findOpenerElement(opener);
  if (button === null) focusHeading();
  else button.focus();
}
