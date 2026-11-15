'use client';

import { KeyRound, LogOut } from 'lucide-react';
import { useState } from 'react';

import { AccountMenuPanel, type AccountMenuItem } from '@/components/shared/account-menu-panel';
import type { AccountPanelProps } from '@/components/shared/account-menu';
import { Icon } from '@/components/shared/icon';
import { signOutOfPortal } from '@/lib/auth/auth-client';
import { ACCOUNT_PATH, SIGN_IN_PATH } from '@/lib/auth/return-path';
import { mayLeave } from '@/lib/estimates/leave-registry';

/**
 * The account menu panel of every signed-in page, with sign-out wired (STORY-01.01 AC-4, SCR-25). It is the code that
 * loads on the first open (`portal-account-menu.tsx`, AQP-188): the Radix menu, the items and the sign-out request.
 *
 * Sign-out asks the server to end the session (it clears the cookie and raises the person's `session_version`,
 * `src/server/auth/options.ts`), then loads the sign-in page with a full page load, so no protected page is left
 * in the browser's router cache. "Change password" opens the account page (SCR-23, STORY-01.05).
 */

const SIGN_OUT_FAILED = 'Sign out did not finish. Check your connection and try again.';

export function PortalAccountPanel({ user, keyboard }: AccountPanelProps) {
  const [failed, setFailed] = useState(false);

  async function endSession(): Promise<void> {
    // The estimate page has an answer to "may I leave?" when something typed is not saved (STORY-05.08 AC-4): the session must not end under it, so the person is asked first. On every other page there is no
    // guard and this is yes at once.
    if (!(await mayLeave())) return;
    if (!(await signOutOfPortal())) {
      setFailed(true);
      return;
    }
    window.location.assign(SIGN_IN_PATH);
  }

  const items: ReadonlyArray<AccountMenuItem> = [
    { label: 'Change password', href: ACCOUNT_PATH, icon: <Icon icon={KeyRound} size="large" /> },
    { label: 'Sign out', icon: <Icon icon={LogOut} size="large" />, onSelect: () => void endSession() },
  ];
  return <AccountMenuPanel user={user} items={items} {...(failed ? { note: SIGN_OUT_FAILED } : {})} keyboard={keyboard} />;
}
