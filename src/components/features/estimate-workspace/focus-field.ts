import { controlIdFor, NEXT_FIELD, PART_FORM_ATTRIBUTE, PART_FORM_TITLE_ID } from './field-ids';

export const RETRY_MILLISECONDS = 50;
/** About two seconds: long enough for a part's form to be read from the server after it is chosen, short enough that a form that never comes is let go. */
export const MAX_ATTEMPTS = 40;

/** Looks again every `RETRY_MILLISECONDS`, up to `MAX_ATTEMPTS` times, for something that a fetch is still bringing; gives up quietly. `look` returns true once it has what it wanted. */
function lookUntilFound(look: () => boolean): void {
  let attempts = 0;
  const again = (): void => {
    if (look()) return;
    attempts += 1;
    if (attempts < MAX_ATTEMPTS) window.setTimeout(again, RETRY_MILLISECONDS);
  };
  again();
}

/**
 * Puts focus on a field of a part once that part's form is on the page (STORY-05.09: the summary of a blocked Calculate links to a field, and choosing the part reads its form, so the field is
 * not there yet). Every part's form has the same field IDs, so the field is looked for **inside the form of this part** (`data-part-id`), never in whichever form is still showing. Focus
 * scrolls the field into view clear of the sticky bars (the page's `scroll-padding`). It gives up quietly after about two seconds.
 */
export function focusFieldWhenPresent(partId: string, fieldId: string): void {
  lookUntilFound(() => {
    const form = document.querySelector(`[${PART_FORM_ATTRIBUTE}][data-part-id="${CSS.escape(partId)}"]`);
    const control = form?.querySelector<HTMLElement>(`#${CSS.escape(controlIdFor(fieldId))}`) ?? null;
    if (control === null || control.matches(':disabled')) return false;
    control.focus();
    return true;
  });
}

/**
 * Where the focus is when the person has already moved on from a tap on a row: in the drawer opened again, in a menu or in a dialog that is OPEN (`data-state="open"`). The drawer that the tap is closing is still a dialog
 * for a moment, with `data-state="closed"`, and the focus may still be in it: that is not moving on, and the title takes the focus.
 */
const MOVED_ON_SELECTOR = '[role="menu"][data-state="open"], [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

/**
 * A tap on a row in the phone drawer opens its form (AQP-490, DEF-133; UX ruling 2026-11-26 item 3 point 7: "tapping the row closes the drawer and shows the form"): the form's title, not a field, takes the focus once that part's
 * form is on the page. A field would put a finger's keyboard on the screen before the person has chosen to type; the title (`tabindex="-1"`) tells a screen reader which part it is and leaves Tab to go to the first field. Looked for
 * inside the form of this part (`data-part-id`), as `focusFieldWhenPresent` does, and it gives up quietly after about two seconds. It also gives up at once when the focus is already in a menu or a dialog (the
 * person opened the drawer again and the "+" menu of a row before the form came): taking the focus then would close their menu under the click (run 45945851576, `estimate-tree-names.spec.ts` NAME-1, phone).
 */
export function focusFormTitleWhenPresent(partId: string): void {
  lookUntilFound(() => {
    const layer = document.activeElement?.closest(MOVED_ON_SELECTOR);
    if (layer !== null && layer !== undefined) return true;
    const title = document.querySelector<HTMLElement>(`[${PART_FORM_ATTRIBUTE}][data-part-id="${CSS.escape(partId)}"] #${PART_FORM_TITLE_ID}`);
    if (title === null) return false;
    title.focus();
    return true;
  });
}

/**
 * Enter on a part in the tree opens its form: the first field that can be typed into takes the focus (STORY-05.03, review SQR-11; STORY-05.13 AC-5). The form's fields are fetched after the page is
 * up (`PartForm` loads `PartFields` with `useLazyComponent`, NFR-009), so on a press that comes before they have arrived this waits for them, as `focusFieldWhenPresent` does, and gives up
 * quietly after about two seconds. This module imports nothing of the fields (`field-ids.ts` only), so the first load does not carry them.
 */
export function focusFirstField(): void {
  lookUntilFound(() => {
    const control = document.querySelector<HTMLElement>(`[${PART_FORM_ATTRIBUTE}] ${NEXT_FIELD}`);
    if (control === null) return false;
    control.focus();
    return true;
  });
}
