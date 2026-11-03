'use client';

import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { PERSISTENT_MENU_MIN_WIDTH } from '@/lib/design-tokens';

import { Header } from './header';
import { Icon } from './icon';
import { Nav, type NavGroup } from './nav';
import { useStickyOffsets } from './use-sticky-offsets';

/** From this width the side menu is persistent (Tailwind `lg` is the same 1024 px). Below it the menu is a drawer. */
const PERSISTENT_MENU_QUERY = `(min-width: ${PERSISTENT_MENU_MIN_WIDTH}px)`;

/** Moves focus to the page title (UX spec section 8 "Focus": after a route change focus goes to the `h1`). */
function focusPageHeading(): void {
  document.querySelector<HTMLElement>('main h1')?.focus();
}

export interface AppShellProps {
  readonly navGroups: ReadonlyArray<NavGroup>;
  readonly bell: ReactNode;
  readonly account: ReactNode;
  readonly children: ReactNode;
}

/**
 * The responsive page frame (FR-085, STORY-10.02 AC-4, UX spec section 6.0 "Page frame"): skip link, top bar,
 * side menu and `main`. At 1024 px and wider the graphite side menu is persistent; below that a menu button
 * in the top bar opens it as a drawer (focus trapped, Escape closes, focus returns to the button). The bell
 * and the account menu stay in the top bar at every width. After a route change focus goes to the page's `h1`.
 */
export function AppShell({ navGroups, bell, account, children }: AppShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const previousPath = useRef(pathname);
  const leavingPage = useRef(false);
  useStickyOffsets();

  // A drawer left open while the window widens to a desktop would trap focus behind a menu that is also
  // shown beside the page.
  useEffect(() => {
    const query = window.matchMedia(PERSISTENT_MENU_QUERY);
    const closeOnDesktop = (event: MediaQueryListEvent): void => {
      if (event.matches) setMenuOpen(false);
    };
    query.addEventListener('change', closeOnDesktop);
    return () => query.removeEventListener('change', closeOnDesktop);
  }, []);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    focusPageHeading();
  }, [pathname]);

  return (
    <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
      <a
        href="#main"
        className="absolute -top-s-7 left-s-3 z-(--z-skip-link) rounded-md bg-ink px-s-4 py-s-2 text-on-fill focus:top-s-2 focus:text-on-fill"
      >
        Skip to main content
      </a>
      <Header
        menuButton={
          <SheetTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="Open menu">
              <Icon icon={Menu} size="large" />
            </Button>
          </SheetTrigger>
        }
        bell={bell}
        account={account}
      />
      <div className="lg:grid lg:grid-cols-[var(--side-w)_minmax(0,1fr)]">
        <aside
          data-on-dark=""
          className="sticky top-(--topbar-h) hidden h-[calc(100vh-var(--topbar-h))] overflow-y-auto bg-nav text-nav-ink lg:block"
        >
          <Nav groups={navGroups} />
        </aside>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-(--page-max) min-w-0 flex-col gap-s-4 p-s-4 outline-none md:gap-s-5 md:p-s-5 lg:p-s-6"
        >
          {children}
        </main>
      </div>
      <SheetContent
        title="Menu"
        closeLabel="Close menu"
        onDark
        className="bg-nav text-nav-ink"
        // Radix returns focus to the menu button when the drawer closes. After choosing another page, focus
        // belongs on that page's title instead (QLT-02), which the effect above sets once the route has changed.
        // The route can change before or after the drawer finishes closing, so the flag is cleared here, where it
        // is used, and not by the route effect: clearing it there let Radix take focus back after the title had it.
        onCloseAutoFocus={(event) => {
          if (!leavingPage.current) return;
          event.preventDefault();
          leavingPage.current = false;
        }}
      >
        <div className="pt-s-7">
          <Nav
            groups={navGroups}
            onNavigate={(href) => {
              leavingPage.current = href !== pathname;
              setMenuOpen(false);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
