'use client';

import type { ComponentType, KeyboardEvent, MouseEvent } from 'react';

import { AccountTrigger, type AccountUser } from '@/components/shared/account-trigger';
import { FirstOpenFailure } from '@/components/shared/first-open-failure';
import { useFirstOpen } from '@/components/shared/use-first-open';
import { EARLY_INTENT_ATTRIBUTE } from '@/lib/ui/early-intent';

export type { AccountUser } from '@/components/shared/account-trigger';

/** What the loaded panel is given. It opens itself, with focus as the way it was opened asks for. */
export interface AccountPanelProps {
  readonly user: AccountUser;
  /** Opened with Enter, Space or ArrowDown: focus goes to the first enabled item. A pointer open leaves it on the menu. */
  readonly keyboard: boolean;
}

export interface AccountMenuProps {
  readonly user: AccountUser;
  /** Fetches the panel on the first open: a bare `import()` of the module that holds the Radix menu and the sign-out wiring. */
  readonly loadPanel: () => Promise<ComponentType<AccountPanelProps>>;
}

const FAILURE_ID = 'account-menu-first-open-failure';
const FAILURE_MESSAGE = 'The account menu did not open. Check your connection and try again.';

/**
 * The account menu in the top bar (SCR-25). Until it is first opened it is a plain button with the same face, role, name
 * and `aria-haspopup="menu"` as the Radix trigger that replaces it: the menu's code (Radix `DropdownMenu`, positioning,
 * sign-out) is not in the first load (AQP-188, NFR-009, architecture section 10). The first press fetches it and shows the
 * pending look (`aria-busy`, UX spec 7.3.1 rule 11); when it arrives the panel opens, with its own trigger in the same
 * place. A press before the page was interactive is kept by the early-tap script and counted here at hydration (AC-10).
 */
export function AccountMenu({ user, loadPanel }: AccountMenuProps) {
  const first = useFirstOpen<AccountPanelProps>({ id: 'account', load: loadPanel });

  if (first.shown && first.Overlay !== null) {
    const Panel = first.Overlay;
    return <Panel user={user} keyboard={first.keyboard} />;
  }

  const onClick = (event: MouseEvent<HTMLButtonElement>): void => first.activate(event.detail === 0);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    first.activate(true);
  };

  return (
    <div className="relative">
      <AccountTrigger
        user={user}
        {...{ [EARLY_INTENT_ATTRIBUTE]: 'account' }}
        suppressHydrationWarning
        aria-haspopup="menu"
        aria-expanded={false}
        aria-busy={first.pending || undefined}
        aria-describedby={first.failed ? FAILURE_ID : undefined}
        onClick={onClick}
        onKeyDown={onKeyDown}
      />
      {first.failed ? <FirstOpenFailure id={FAILURE_ID} message={FAILURE_MESSAGE} align="right" /> : null}
    </div>
  );
}
