'use client';

import { useEffect } from 'react';

/**
 * The phone's accordion of SCR-07 (STORY-06.03 AC-9; UX spec SCR-07 "Responsive"): at 360 px only stage 1 is open, so the page opens short and the Lead opens the stage they want; at 768 px and wider
 * every stage is open. The stages are server-rendered `details` panels that are all open, so with no script (or before it runs) nothing is hidden. This closes stages 2 to 6 once, after load, on a
 * phone-wide screen, and never again: a Lead's own opening and closing is left alone. It renders nothing, holds no figure and takes none.
 */
export const PHONE_MAX_WIDTH_QUERY = '(max-width: 767px)';

export function PhoneStages() {
  useEffect(() => {
    if (!window.matchMedia(PHONE_MAX_WIDTH_QUERY).matches) return;
    for (const panel of document.querySelectorAll<HTMLDetailsElement>('details[data-stage]')) panel.open = panel.dataset['stage'] === '1';
  }, []);
  return null;
}
