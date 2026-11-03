'use client';

import { useEffect, useRef } from 'react';

/** Moves focus to the page title (UX spec section 8 "Focus": after a route change focus goes to the `h1`). */
function focusPageHeading(): void {
  document.querySelector<HTMLElement>('main h1')?.focus();
}

export interface TitleFocus {
  /** Call when a menu link is chosen, with the link's address. */
  readonly onNavigate: (href: string) => void;
  /** Pass to the drawer's `onCloseAutoFocus`. */
  readonly onCloseAutoFocus: (event: Event) => void;
}

/**
 * After a route change, focus goes to the new page's `h1` (QLT-02). When the page is left through the menu drawer,
 * Radix would also return focus to the menu button as the drawer closes; that return is prevented, so the title
 * keeps focus.
 *
 * The route can change before or after the drawer finishes closing, so the "leaving the page" flag is cleared in
 * `onCloseAutoFocus`, where it is used, and not by the route effect: clearing it there let Radix take focus back
 * after the title had it. (The same path chosen again changes no route, so Radix's return to the button stands.)
 */
export function useFocusTitleAfterNavigation(pathname: string): TitleFocus {
  const previousPath = useRef(pathname);
  const leavingPage = useRef(false);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    focusPageHeading();
  }, [pathname]);

  return {
    onNavigate: (href) => {
      leavingPage.current = href !== pathname;
    },
    onCloseAutoFocus: (event) => {
      if (!leavingPage.current) return;
      event.preventDefault();
      leavingPage.current = false;
    },
  };
}
