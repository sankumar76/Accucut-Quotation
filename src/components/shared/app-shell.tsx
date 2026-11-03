'use client';

import { Menu } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

import { Header } from './header';
import { Nav, type NavGroup } from './nav';
import { useStickyOffsets } from './use-sticky-offsets';

/** The width from which the side menu is persistent (Tailwind `lg`). Below it the menu is a drawer. */
const PERSISTENT_MENU_QUERY = '(min-width: 1024px)';

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
 * and the account menu stay in the top bar at every width.
 */
export function AppShell({ navGroups, bell, account, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
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

  return (
    <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
      <a
        href="#main"
        className="absolute -top-s-7 left-s-3 z-[100] rounded-md bg-ink px-s-4 py-s-2 text-on-fill focus:top-s-2 focus:text-on-fill"
      >
        Skip to main content
      </a>
      <Header
        menuButton={
          <SheetTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="Open menu">
              <Menu aria-hidden="true" focusable="false" size={20} />
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
      <SheetContent title="Menu" closeLabel="Close menu" onDark className="bg-nav text-nav-ink">
        <div className="pt-s-7">
          <Nav groups={navGroups} onNavigate={() => setMenuOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
