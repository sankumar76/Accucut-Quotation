'use client';

import { useEffect } from 'react';

import { PERSISTENT_MENU_MIN_WIDTH } from '@/lib/design-tokens';

/** From this width the side menu is persistent (Tailwind `lg` is the same 1024 px). Below it the menu is a drawer. */
const PERSISTENT_MENU_QUERY = `(min-width: ${PERSISTENT_MENU_MIN_WIDTH}px)`;

/**
 * Closes the menu drawer when the window widens to a desktop. A drawer left open there would trap focus behind a
 * menu that is also shown beside the page.
 */
export function useCloseDrawerOnDesktop(setMenuOpen: (open: boolean) => void): void {
  useEffect(() => {
    const query = window.matchMedia(PERSISTENT_MENU_QUERY);
    const closeOnDesktop = (event: MediaQueryListEvent): void => {
      if (event.matches) setMenuOpen(false);
    };
    query.addEventListener('change', closeOnDesktop);
    return () => query.removeEventListener('change', closeOnDesktop);
  }, [setMenuOpen]);
}
