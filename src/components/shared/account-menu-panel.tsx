'use client';

import Link from 'next/link';
import { useRef, type ReactNode } from 'react';

import { AccountTrigger, type AccountUser } from '@/components/shared/account-trigger';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export interface AccountMenuItem {
  readonly label: string;
  /** Where the action goes. */
  readonly href?: string;
  /** What the action does, for an item that is not a link (sign out). With neither `href` nor `onSelect` the item is shown disabled (its page does not exist yet). */
  readonly onSelect?: () => void;
  readonly icon: ReactNode;
}

export interface AccountMenuPanelProps {
  readonly user: AccountUser;
  readonly items?: ReadonlyArray<AccountMenuItem>;
  /** One line of plain text shown under the items, for a menu that has fewer actions than it will have. */
  readonly note?: string;
  /** Opened with the keyboard: focus goes to the first enabled item (AQP-188 AC-4). */
  readonly keyboard: boolean;
}

/**
 * Where Radix puts focus when the menu opens. A keyboard open focuses the first enabled item. Radix decides that from the
 * last key it saw, but the menu is first mounted after the key was pressed, so it cannot know: the caller says it.
 * A pointer open keeps Radix's own behaviour (focus on the menu itself), as before the menu was loaded on demand.
 */
function focusFirstEnabledItem(event: Event): void {
  const menu = event.currentTarget;
  if (!(menu instanceof HTMLElement)) return;
  const first = menu.querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])');
  if (first === null) return;
  event.preventDefault();
  first.focus();
}

/**
 * The account menu once its code has loaded (AQP-188): the Radix menu with its own trigger, which has the same face as the
 * plain button it replaces, in the same place. It opens at once (`defaultOpen`), then behaves as Radix menus do: arrow keys
 * move, Escape closes and returns focus to the trigger. Not modal on purpose: a modal menu hides the rest of the page from
 * assistive technology while its controls stay focusable (axe `aria-hidden-focus`).
 */
export function AccountMenuPanel({ user, items = [], note, keyboard }: AccountMenuPanelProps) {
  // The override is for the open that mounted the menu only (QLT-55). From then on the Radix trigger sees every key itself,
  // so a later keyboard open focuses the first item as Radix does, and a later pointer open leaves focus on the menu.
  const openedByKeyboard = useRef(keyboard);
  const focusOnOpen = (event: Event): void => {
    if (!openedByKeyboard.current) return;
    openedByKeyboard.current = false;
    focusFirstEnabledItem(event);
  };

  return (
    <div className="relative">
      <DropdownMenu modal={false} defaultOpen>
        <DropdownMenuTrigger asChild>
          <AccountTrigger user={user} />
        </DropdownMenuTrigger>
        {/* `onOpenAutoFocus` is a prop of Radix's menu content that its public types leave out; the content forwards it. `shell-lazy-load.spec.ts` (AC-4, QLT-55) fails if a Radix upgrade stops doing so. */}
        <DropdownMenuContent {...{ onOpenAutoFocus: focusOnOpen }}>
          <DropdownMenuLabel>
            <span className="font-semibold text-ink">{user.name}</span>
            <span className="text-label text-ink-2">{user.email}</span>
            <span className="text-label text-ink-2">{user.role}</span>
          </DropdownMenuLabel>
          {items.map((item) =>
            item.href === undefined ? (
              <DropdownMenuItem key={item.label} disabled={item.onSelect === undefined} {...(item.onSelect === undefined ? {} : { onSelect: item.onSelect })}>
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem key={item.label} asChild>
                <Link href={item.href}>
                  {item.icon}
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ),
          )}
          {note === undefined ? null : <p className="px-s-3 py-s-2 text-label text-ink-2">{note}</p>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
