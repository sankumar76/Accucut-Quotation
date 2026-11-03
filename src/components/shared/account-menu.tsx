'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { initialsOf } from '@/lib/initials';

export interface AccountUser {
  readonly name: string;
  readonly email: string;
  readonly role: string;
}

export interface AccountMenuItem {
  readonly label: string;
  /** Where the action goes. Without it the item is shown disabled (its page does not exist yet). */
  readonly href?: string;
  readonly icon: ReactNode;
}

export interface AccountMenuProps {
  readonly user: AccountUser;
  readonly items?: ReadonlyArray<AccountMenuItem>;
  /** One line of plain text shown under the items, for a menu that has fewer actions than it will have. */
  readonly note?: string;
}

/**
 * The account menu in the top bar (SCR-25): name, e-mail and role, then the actions. On a phone only the
 * avatar and the arrow show; the full name stays in the accessible name of the button.
 */
export function AccountMenu({ user, items = [], note }: AccountMenuProps) {
  // Not modal: a modal menu hides the rest of the page from assistive technology while its controls stay
  // focusable (axe aria-hidden-focus).
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={`Account menu, ${user.name}, ${user.role}`}
        className="flex min-h-(--control-h) cursor-pointer items-center gap-s-2 rounded-md border border-border bg-surface px-s-2 text-left hover:bg-surface-2 md:gap-s-3 md:pr-s-3"
      >
        <span
          aria-hidden="true"
          className="inline-flex h-s-6 w-s-6 shrink-0 items-center justify-center rounded-full bg-nav text-label font-semibold text-on-fill"
        >
          {initialsOf(user.name)}
        </span>
        <span aria-hidden="true" className="hidden min-w-0 md:block">
          <span className="block truncate font-semibold text-ink">{user.name}</span>
          <span className="block text-label text-ink-2">{user.role}</span>
        </span>
        <ChevronDown aria-hidden="true" focusable="false" size={16} className="shrink-0 text-ink-2" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <span className="font-semibold text-ink">{user.name}</span>
          <span className="text-label text-ink-2">{user.email}</span>
          <span className="text-label text-ink-2">{user.role}</span>
        </DropdownMenuLabel>
        {items.map((item) =>
          item.href === undefined ? (
            <DropdownMenuItem key={item.label} disabled>
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
  );
}
