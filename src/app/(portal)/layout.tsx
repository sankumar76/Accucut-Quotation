import { House, KeyRound, LogOut, Palette } from 'lucide-react';
import type { ReactNode } from 'react';

import { AccountMenu, type AccountMenuItem, type AccountUser } from '@/components/shared/account-menu';
import { AppShell } from '@/components/shared/app-shell';
import { BellLink } from '@/components/shared/bell-link';
import type { NavGroup } from '@/components/shared/nav';
import { isDesignSystemAvailable } from '@/lib/design-system-gate';

const ICON_SIZE = 20;

/**
 * Invented person for the account menu until sign-in exists (STORY-01.01 / 01.02 replace this with the
 * session user). The e-mail uses the reserved .test domain.
 */
const PREVIEW_USER: AccountUser = { name: 'Preview User', email: 'preview.user@example.test', role: 'Preview' };
const ACCOUNT_ITEMS: ReadonlyArray<AccountMenuItem> = [
  { label: 'Change password', icon: <KeyRound aria-hidden="true" focusable="false" size={ICON_SIZE} /> },
  { label: 'Sign out', icon: <LogOut aria-hidden="true" focusable="false" size={ICON_SIZE} /> },
];
const ACCOUNT_NOTE = 'Both actions are switched on by the sign-in story (STORY-01.01).';

/**
 * The menu until the role-specific menus arrive (STORY-01.02, SCR-25). The design system is listed only
 * where its route exists, that is outside a production build.
 */
function navGroups(): ReadonlyArray<NavGroup> {
  const work: NavGroup = {
    label: 'Work',
    items: [{ label: 'Home', href: '/', icon: <House aria-hidden="true" focusable="false" size={ICON_SIZE} /> }],
  };
  const review: NavGroup = {
    label: 'Review',
    items: [{ label: 'Design system', href: '/design-system', icon: <Palette aria-hidden="true" focusable="false" size={ICON_SIZE} /> }],
  };
  return isDesignSystemAvailable(process.env.NODE_ENV) ? [work, review] : [work];
}

/** The page frame of every signed-in page (route group `(portal)`): top bar, side menu, skip link, `main`. */
export default function PortalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AppShell navGroups={navGroups()} bell={<BellLink href="/" />} account={<AccountMenu user={PREVIEW_USER} items={ACCOUNT_ITEMS} note={ACCOUNT_NOTE} />}>
      {children}
    </AppShell>
  );
}
