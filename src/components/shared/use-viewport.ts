'use client';

import { useSyncExternalStore } from 'react';

import { PERSISTENT_MENU_MIN_WIDTH, TABLET_MIN_WIDTH } from '@/lib/design-tokens';

export type Viewport = 'phone' | 'tablet' | 'desktop';

const TABLET_QUERY = `(min-width: ${TABLET_MIN_WIDTH}px)`;
const DESKTOP_QUERY = `(min-width: ${PERSISTENT_MENU_MIN_WIDTH}px)`;

function subscribe(onChange: () => void): () => void {
  const lists = [window.matchMedia(TABLET_QUERY), window.matchMedia(DESKTOP_QUERY)];
  for (const list of lists) list.addEventListener('change', onChange);
  return () => {
    for (const list of lists) list.removeEventListener('change', onChange);
  };
}

function current(): Viewport {
  if (window.matchMedia(DESKTOP_QUERY).matches) return 'desktop';
  return window.matchMedia(TABLET_QUERY).matches ? 'tablet' : 'phone';
}

/**
 * The width class of the window: phone (below 768 px), tablet (768 to 1023) or desktop (1024 and up). It is read from the browser, so the server and the first paint
 * assume desktop and a phone corrects it at once. A component that must show one layout and not two (a panel that is a drawer on a phone, so its ids and roles are not
 * in the page twice) uses it instead of hiding one copy with CSS.
 */
export function useViewport(): Viewport {
  return useSyncExternalStore(subscribe, current, () => 'desktop');
}
