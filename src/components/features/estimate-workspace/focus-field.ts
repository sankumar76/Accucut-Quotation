import { controlIdFor } from './field-renderer';

const RETRY_MILLISECONDS = 50;
/** About two seconds: long enough for a part's form to be read from the server after it is chosen, short enough that a form that never comes is let go. */
const MAX_ATTEMPTS = 40;

/**
 * Puts focus on a field of a part once that part's form is on the page (STORY-05.09: the summary of a blocked Calculate links to a field, and choosing the part reads its form, so the field is
 * not there yet). Every part's form has the same field IDs, so the field is looked for **inside the form of this part** (`data-part-id`), never in whichever form is still showing. Focus
 * scrolls the field into view clear of the sticky bars (the page's `scroll-padding`). It gives up quietly after about two seconds.
 */
export function focusFieldWhenPresent(partId: string, fieldId: string): void {
  let attempts = 0;
  const look = (): void => {
    const form = document.querySelector(`[data-part-form][data-part-id="${CSS.escape(partId)}"]`);
    const control = form?.querySelector<HTMLElement>(`#${CSS.escape(controlIdFor(fieldId))}`) ?? null;
    if (control !== null && !control.matches(':disabled')) {
      control.focus();
      return;
    }
    attempts += 1;
    if (attempts < MAX_ATTEMPTS) window.setTimeout(look, RETRY_MILLISECONDS);
  };
  look();
}
