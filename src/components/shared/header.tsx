import type { ReactNode } from 'react';

import { BrandLockup } from './brand-lockup';

export interface HeaderProps {
  /** The menu button; shown below 1024 px only (the side menu is persistent from 1024 px). */
  readonly menuButton: ReactNode;
  /** Slot for the bell (overdue tasks). Stays in the top bar at every width. */
  readonly bell: ReactNode;
  /** Slot for the account menu. Stays in the top bar at every width. */
  readonly account: ReactNode;
}

/**
 * The top bar (banner landmark): white, sticky, 64 px or more. It declares itself a sticky bar so the
 * measured offset keeps focus clear of it (use-sticky-offsets.ts).
 */
export function Header({ menuButton, bell, account }: HeaderProps) {
  return (
    <header
      data-sticky-bar="top"
      className="sticky top-0 z-(--z-bar) flex min-h-(--topbar-h) items-center gap-s-2 border-b border-border bg-surface px-s-3 md:gap-s-4 md:px-s-4 lg:px-s-5"
    >
      <div className="lg:hidden">{menuButton}</div>
      <BrandLockup href="/" className="flex-1 lg:flex-none" />
      <div className="hidden flex-1 lg:block" />
      {bell}
      {account}
    </header>
  );
}
