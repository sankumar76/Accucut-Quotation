import { Bell } from 'lucide-react';
import Link from 'next/link';

import { Icon } from './icon';

export interface BellLinkProps {
  /** Where the overdue tasks are listed. */
  readonly href: string;
  /** Number of overdue tasks. Omit while no count is available (the bell shows no badge). */
  readonly count?: number;
}

/** The bell in the top bar: a 44 px link whose name says what it is and how many tasks are overdue. */
export function BellLink({ href, count }: BellLinkProps) {
  const label = count === undefined ? 'Overdue tasks' : `Overdue tasks: ${count}`;
  return (
    <Link
      href={href}
      aria-label={label}
      className="relative inline-flex h-(--control-h) w-(--control-h) shrink-0 items-center justify-center rounded-md border border-border bg-surface text-ink no-underline hover:bg-surface-2 hover:text-ink"
    >
      <Icon icon={Bell} size="large" />
      {count === undefined || count === 0 ? null : (
        <span
          aria-hidden="true"
          className="absolute -top-s-2 -right-s-2 inline-flex h-s-5 min-w-s-5 items-center justify-center rounded-full border-2 border-surface bg-accent px-s-1 text-label leading-none font-semibold text-on-fill"
        >
          {count}
        </span>
      )}
    </Link>
  );
}
