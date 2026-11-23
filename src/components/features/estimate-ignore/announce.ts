/**
 * A polite live region that outlives the page being drawn again (CR-01 item 7D, AQP-401 AC-8; UX 12944 sections 2 and 3: "the polite status is the exact sentence"). After Ignore or Restore the server draws the page again
 * (`router.refresh()`) and the button that was pressed leaves with the dialog, so a status written into either would go with them. This one is a node of the document itself, made before the action is sent (a live
 * region that exists before its text changes is the one assistive technology announces) and written to once the page is drawn again. It is only ever used from the dialogs, so it is in no first load (NFR-009).
 */

const ANNOUNCER_ID = 'page-announcer';
/** The pause that lets the empty region be read first, so the text that follows is announced as a change. */
const ANNOUNCE_DELAY_MS = 150;

/** The region, made the first time it is asked for and found again after. Empty until `announce` writes to it. */
export function prepareAnnouncer(): HTMLElement {
  const found = document.getElementById(ANNOUNCER_ID);
  if (found !== null) return found;
  const region = document.createElement('div');
  region.id = ANNOUNCER_ID;
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.className = 'sr-only';
  document.body.appendChild(region);
  return region;
}

/** Writes the sentence into the region after a short pause. A second call replaces the first. */
export function announce(text: string): void {
  const region = prepareAnnouncer();
  region.textContent = '';
  window.setTimeout(() => {
    region.textContent = text;
  }, ANNOUNCE_DELAY_MS);
}
