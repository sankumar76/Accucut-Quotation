'use client';

import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

import { Header } from './header';
import { Icon } from './icon';
import { Nav, type NavGroup } from './nav';
import { useCloseDrawerOnDesktop } from './use-close-drawer-on-desktop';
import { useFocusTitleAfterNavigation } from './use-focus-title-after-navigation';
import { useStickyOffsets } from './use-sticky-offsets';

export interface AppShellProps {
  readonly navGroups: ReadonlyArray<NavGroup>;
  readonly bell: ReactNode;
  readonly account: ReactNode;
  readonly children: ReactNode;
}

/** The skip link: the first stop on every page, hidden until it has focus. */
function SkipLink() {
  return (
    <a
      href="#main"
      className="absolute -top-s-7 left-s-3 z-(--z-skip-link) rounded-md bg-ink px-s-4 py-s-2 text-on-fill focus:top-s-2 focus:text-on-fill"
    >
      Skip to main content
    </a>
  );
}

/** The menu button in the top bar; it opens the drawer (shown below 1024 px only, by the header). */
function MenuButton() {
  return (
    <SheetTrigger asChild>
      <Button variant="secondary" size="icon" aria-label="Open menu">
        <Icon icon={Menu} size="large" />
      </Button>
    </SheetTrigger>
  );
}

interface MenuDrawerProps {
  readonly groups: ReadonlyArray<NavGroup>;
  readonly onNavigate: (href: string) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

/** The side menu as a drawer: focus trapped, Escape closes, focus returns to the menu button unless a page was chosen. */
function MenuDrawer({ groups, onNavigate, onCloseAutoFocus }: MenuDrawerProps) {
  return (
    <SheetContent title="Menu" closeLabel="Close menu" onDark className="bg-nav text-nav-ink" onCloseAutoFocus={onCloseAutoFocus}>
      <div className="pt-s-7">
        <Nav groups={groups} onNavigate={onNavigate} />
      </div>
    </SheetContent>
  );
}

/**
 * The responsive page frame (FR-085, STORY-10.02 AC-4, UX spec section 6.0 "Page frame"): skip link, top bar,
 * side menu and `main`. At 1024 px and wider the graphite side menu is persistent; below that a menu button
 * in the top bar opens it as a drawer. The bell and the account menu stay in the top bar at every width. After a
 * route change focus goes to the page's `h1`.
 */
export function AppShell({ navGroups, bell, account, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const titleFocus = useFocusTitleAfterNavigation(usePathname());
  useStickyOffsets();
  useCloseDrawerOnDesktop(setMenuOpen);

  return (
    <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
      <SkipLink />
      <Header menuButton={<MenuButton />} bell={bell} account={account} />
      <div className="lg:grid lg:grid-cols-[var(--side-w)_minmax(0,1fr)]">
        <aside data-on-dark="" className="sticky top-(--topbar-h) hidden h-[calc(100vh-var(--topbar-h))] overflow-y-auto bg-nav text-nav-ink lg:block">
          <Nav groups={navGroups} />
        </aside>
        <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-(--page-max) min-w-0 flex-col gap-s-4 p-s-4 outline-none md:gap-s-5 md:p-s-5 lg:p-s-6">
          {children}
        </main>
      </div>
      <MenuDrawer
        groups={navGroups}
        onCloseAutoFocus={titleFocus.onCloseAutoFocus}
        onNavigate={(href) => {
          titleFocus.onNavigate(href);
          setMenuOpen(false);
        }}
      />
    </Sheet>
  );
}
