'use client';

import { AccountMenu, type AccountUser } from '@/components/shared/account-menu';

/**
 * The account menu of every signed-in page (STORY-01.01 AC-4, SCR-25). The signed-in person comes from the server layout;
 * this component only says where the menu's code is. The menu, its items and the sign-out request are in
 * `portal-account-panel.tsx`, which is fetched the first time the menu is opened and is not in the first load
 * (AQP-188, NFR-009). A bare `import()` and not `next/dynamic`, so a failed request can be tried again.
 */

const loadPortalAccountPanel = () => import('./portal-account-panel').then((module) => module.PortalAccountPanel);

export interface PortalAccountMenuProps {
  readonly user: AccountUser;
}

export function PortalAccountMenu({ user }: PortalAccountMenuProps) {
  return <AccountMenu user={user} loadPanel={loadPortalAccountPanel} />;
}
