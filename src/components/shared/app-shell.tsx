'use client';

import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useRef, useState, type ReactNode, type RefObject } from 'react';

import { FirstOpenFailure } from '@/components/shared/first-open-failure';
import { Button } from '@/components/ui/button';
import { EARLY_INTENT_ATTRIBUTE } from '@/lib/ui/early-intent';

import { Header } from './header';
import { Icon } from './icon';
import type { MenuDrawerProps } from './menu-drawer';
import { Nav, type NavGroup } from './nav';
import { SkipLink } from './skip-link';
import { useCloseDrawerOnDesktop } from './use-close-drawer-on-desktop';
import { useFirstOpen, useFinishEarlyIntent, type FirstOpenControl } from './use-first-open';
import { useFocusTitleAfterNavigation } from './use-focus-title-after-navigation';
import { useStickyOffsets } from './use-sticky-offsets';

export interface AppShellProps {
  readonly navGroups: ReadonlyArray<NavGroup>;
  readonly bell: ReactNode;
  readonly account: ReactNode;
  readonly children: ReactNode;
}

const FAILURE_ID = 'menu-drawer-first-open-failure';
const FAILURE_MESSAGE = 'The menu did not open. Check your connection and try again.';

/** The drawer's code: a bare `import()`, so a failed request can be tried again (architecture section 10). */
const loadMenuDrawer = () => import('./menu-drawer').then((module) => module.MenuDrawer);

interface MenuButtonProps {
  readonly open: boolean;
  readonly first: FirstOpenControl<MenuDrawerProps>;
  readonly buttonRef: RefObject<HTMLButtonElement | null>;
}

/**
 * The menu button in the top bar; it opens the drawer (shown below 1024 px only, by the header). A plain button that
 * owns the open state: the drawer's code is fetched on the first press and the button shows the pending look while it
 * loads (UX spec 7.3.1 rule 11). It is never `loading` (that disables it); Escape must reach it and a second press must be ignored.
 */
function MenuButton({ open, first, buttonRef }: MenuButtonProps) {
  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="secondary"
        size="icon"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={first.pending || undefined}
        aria-describedby={first.failed ? FAILURE_ID : undefined}
        {...{ [EARLY_INTENT_ATTRIBUTE]: 'menu' }}
        suppressHydrationWarning
        onClick={(event) => first.activate(event.detail === 0)}
      >
        <Icon icon={Menu} size="large" />
      </Button>
      {first.failed ? <FirstOpenFailure id={FAILURE_ID} message={FAILURE_MESSAGE} align="left" /> : null}
    </div>
  );
}

/**
 * The responsive page frame (FR-085, STORY-10.02 AC-4, UX spec section 6.0 "Page frame"): skip link, top bar,
 * side menu and `main`. At 1024 px and wider the graphite side menu is persistent; below that a menu button
 * in the top bar opens it as a drawer. The bell and the account menu stay in the top bar at every width. After a
 * route change focus goes to the page's `h1`.
 *
 * The drawer is not in the first load (AQP-188, NFR-009): its code is fetched on the first press of the menu button,
 * through the loader every overlay uses (`use-first-open.ts`), and stays mounted afterwards.
 */
export function AppShell({ navGroups, bell, account, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const titleFocus = useFocusTitleAfterNavigation(usePathname());
  const drawer = useFirstOpen<MenuDrawerProps>({ id: 'menu', load: loadMenuDrawer, onOpen: () => setMenuOpen(true) });
  useStickyOffsets();
  useCloseDrawerOnDesktop(setMenuOpen);
  // After the controls have read the early tap (this effect runs after theirs).
  useFinishEarlyIntent();

  // Radix has no trigger to return focus to, so the button gets it back here unless a page was chosen (QLT-02).
  const returnFocusToMenuButton = (event: Event): void => {
    titleFocus.onCloseAutoFocus(event);
    if (event.defaultPrevented) return;
    event.preventDefault();
    menuButton.current?.focus();
  };
  const chooseLink = (href: string): void => {
    titleFocus.onNavigate(href);
    setMenuOpen(false);
  };
  const Drawer = drawer.Overlay;

  return (
    <>
      <SkipLink />
      <Header menuButton={<MenuButton open={menuOpen} first={drawer} buttonRef={menuButton} />} bell={bell} account={account} />
      <div className="lg:grid lg:grid-cols-[var(--side-w)_minmax(0,1fr)]">
        <aside data-on-dark="" className="sticky top-(--topbar-h) hidden h-[calc(100vh-var(--topbar-h))] overflow-y-auto bg-nav text-nav-ink lg:block">
          <Nav groups={navGroups} />
        </aside>
        <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-(--page-max) min-w-0 flex-col gap-s-4 p-s-4 outline-none md:gap-s-5 md:p-s-5 lg:p-s-6">
          {children}
        </main>
      </div>
      {Drawer === null ? null : (
        <Drawer groups={navGroups} open={menuOpen} onOpenChange={setMenuOpen} onNavigate={chooseLink} onCloseAutoFocus={returnFocusToMenuButton} />
      )}
    </>
  );
}
