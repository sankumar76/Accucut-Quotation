import type { ReactNode } from 'react';

import { PortalAccountMenu } from '@/components/features/auth/portal-account-menu';
import { AppShell } from '@/components/shared/app-shell';
import { BellLink } from '@/components/shared/bell-link';
import { EARLY_INTENT_SCRIPT } from '@/lib/ui/early-intent-script';
import { requireUserOrRedirect } from '@/server/auth/session';

import { portalFrameProps } from './portal-frame-props';

/**
 * The page frame of every signed-in page (route group `(portal)`): top bar, side menu, skip link, `main`. It
 * is also the sign-in check of the whole group: a visitor without a valid session is sent to the sign-in page
 * before any child renders (`requireUserOrRedirect` reads the database, so a deactivation takes effect at once). It does not send a
 * person who has to set a new password to the account page: each page does that through `authorizePage`. The layout only leaves the
 * side menu out for them ("Set a new password", STORY-01.05 AC-5).
 *
 * The inline script keeps a tap on the menu button or the account menu made before the page is interactive
 * (AQP-188 AC-10, DEF-013). It has no `src`, so it is not part of the JavaScript budget, and it holds no user data.
 */
export default async function PortalLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await requireUserOrRedirect();
  const frame = portalFrameProps(user);
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: EARLY_INTENT_SCRIPT }} />
      <AppShell navGroups={frame.navGroups} withMenu={frame.withMenu} bell={<BellLink href="/" />} account={<PortalAccountMenu user={frame.account} />}>
        {children}
      </AppShell>
    </>
  );
}
