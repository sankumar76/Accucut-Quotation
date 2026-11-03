'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { isActivePath } from '@/lib/nav';

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: ReactNode;
}

export interface NavGroup {
  readonly label: string;
  readonly items: ReadonlyArray<NavItem>;
}

export interface NavProps {
  readonly groups: ReadonlyArray<NavGroup>;
  /** Called when a link is chosen, so the drawer can close. */
  readonly onNavigate?: (href: string) => void;
}

/**
 * The side menu (navigation landmark): graphite, grouped, one 44 px row per entry. The current page has
 * `aria-current="page"`, a lighter row and the red marker, so it is not shown by colour alone. Which entries
 * a role sees is decided by the caller (STORY-01.02, SCR-25).
 */
export function Nav({ groups, onNavigate }: NavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-col gap-s-1 p-s-3">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-s-1">
          <p className="px-s-3 pt-s-4 pb-s-2 text-label font-semibold tracking-wider text-nav-muted uppercase">{group.label}</p>
          <ul className="flex flex-col gap-s-1">
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    {...(onNavigate === undefined ? {} : { onClick: () => onNavigate(item.href) })}
                    className={cn(
                      'relative flex min-h-(--control-h) items-center gap-s-3 rounded-md px-s-3 font-semibold text-nav-ink no-underline hover:bg-nav-2 hover:text-on-fill',
                      active && 'bg-nav-2 text-on-fill before:absolute before:inset-y-s-2 before:-left-s-3 before:w-s-1 before:rounded-r-sm before:bg-primary',
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
