'use client';

import { useEffect } from 'react';

/**
 * Moves focus to the page's heading when the page appears, so a keyboard or screen-reader user starts at what the page says
 * (STORY-01.06 AC-6: the "Session ended" page and the "Session ended" state of the sign-in page). It draws nothing. It reads
 * the heading by its place, the one `h1` inside `main`, so the page does not need to pass a reference through a server component.
 */
export function FocusMainHeading() {
  useEffect(() => {
    document.querySelector<HTMLElement>('main h1')?.focus();
  }, []);
  return null;
}
