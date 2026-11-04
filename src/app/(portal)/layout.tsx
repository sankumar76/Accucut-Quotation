import { House, ListChecks, Palette } from 'lucide-react';
import type { ReactNode } from 'react';

import { PortalAccountMenu } from '@/components/features/auth/portal-account-menu';
import { AppShell } from '@/components/shared/app-shell';
import { BellLink } from '@/components/shared/bell-link';
import { Icon } from '@/components/shared/icon';
import type { NavGroup } from '@/components/shared/nav';
import { queueTitleFor, roleLabel, type RoleName } from '@/lib/auth/roles';
import { isDesignSystemAvailable } from '@/lib/design-system-gate';
import { requireUserOrRedirect } from '@/server/auth/session';

/**
 * The menu until the role-specific menus arrive (STORY-01.02, SCR-25). The task queue is the one page every
 * role lands on after signing in (STORY-01.01 AC-1). The design system is listed only where its route exists, that
 * is outside a production build.
 */
function navGroups(role: RoleName): ReadonlyArray<NavGroup> {
  const work: NavGroup = {
    label: 'Work',
    items: [
      { label: queueTitleFor(role), href: '/queue', icon: <Icon icon={ListChecks} size="large" /> },
      { label: 'Home', href: '/', icon: <Icon icon={House} size="large" /> },
    ],
  };
  const review: NavGroup = {
    label: 'Review',
    items: [{ label: 'Design system', href: '/design-system', icon: <Icon icon={Palette} size="large" /> }],
  };
  return isDesignSystemAvailable() ? [work, review] : [work];
}

/**
 * The page frame of every signed-in page (route group `(portal)`): top bar, side menu, skip link, `main`. It
 * is also the sign-in check of the whole group: a visitor without a valid session is sent to the sign-in page
 * before any child renders (`requireUserOrRedirect` reads the database, so a deactivation takes effect at once).
 */
export default async function PortalLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await requireUserOrRedirect();
  return (
    <AppShell
      navGroups={navGroups(user.role)}
      bell={<BellLink href="/" />}
      account={<PortalAccountMenu user={{ name: user.name, email: user.email, role: roleLabel(user.role) }} />}
    >
      {children}
    </AppShell>
  );
}
