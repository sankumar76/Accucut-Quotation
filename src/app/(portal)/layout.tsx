import type { ReactNode } from 'react';

import { PortalAccountMenu } from '@/components/features/auth/portal-account-menu';
import { AppShell } from '@/components/shared/app-shell';
import { BellLink } from '@/components/shared/bell-link';
import { isAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { bellHrefFor } from '@/lib/tasks/overdue';
import { EARLY_INTENT_SCRIPT } from '@/lib/ui/early-intent-script';
import { requireUserOrRedirect } from '@/server/auth/session';
import { getTaskService } from '@/server/composition';

import { portalFrameProps } from './portal-frame-props';

/**
 * The bell's count for the signed-in person, read once when the page is loaded (STORY-04.03 AC-2, assumption A-1: no live push, so it is not refreshed until the
 * next load). A count that cannot be read must not take the whole page frame down with it: the bell then shows no badge (its name stays "Overdue tasks"), the
 * kind of the failure is logged (never its cause, which may name a host), and the page the person asked for still opens.
 */
async function bellCount(user: Awaited<ReturnType<typeof requireUserOrRedirect>>): Promise<number | undefined> {
  try {
    return await getTaskService().countOverdue(user);
  } catch (error) {
    logger.warn({ errorName: error instanceof Error ? error.name : 'unknown', errorCode: isAppError(error) ? error.code : undefined }, 'The overdue count could not be read.');
    return undefined;
  }
}

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
  const overdueCount = await bellCount(user);
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: EARLY_INTENT_SCRIPT }} />
      <AppShell navGroups={frame.navGroups} withMenu={frame.withMenu} bell={<BellLink href={bellHrefFor(user.role)} {...(overdueCount === undefined ? {} : { count: overdueCount })} />} account={<PortalAccountMenu user={frame.account} />}>
        {children}
      </AppShell>
    </>
  );
}
