import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { BREAK_LONG_NAMES } from './break-long-names';

/** One step of the breadcrumb: a link, or (the last one) the page itself. */
export interface Crumb {
  readonly label: string;
  /** Absent on the page itself, which is `aria-current="page"` and not a link. */
  readonly href?: string;
}

export interface PageHeadProps {
  /** The way back, ending with the page itself: "My tasks / Q-2026-0318", "Task queue / Q-2026-0318 / Cost details 1.4". */
  readonly crumbs: ReadonlyArray<Crumb>;
  /** The page's `h1`, for example "Estimate Q-2026-0318". */
  readonly title: string;
  /** The badges that stand on the line of the title (the status, the download marker). */
  readonly badges?: ReactNode;
  /** The sentence or the meta line under the title. */
  readonly description?: ReactNode;
  /** What sits at the right of the head (the due pill, buttons); on a phone it is under the description. */
  readonly actions?: ReactNode;
}

/**
 * The head of the pages of one estimate (SCR-05, SCR-06, SCR-07, SCR-10; UX spec section 6.0 "Page frame"; the conformance check C-G-03, AQP-452): a breadcrumb that ends with the page, the `h1` with its badges on
 * one line, the description or meta line under them, and the actions at the right. A server component with no script. The title wraps anywhere, so a long code never scrolls the page sideways.
 */
export function PageHead({ crumbs, title, badges, description, actions }: PageHeadProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-s-4">
      <div className="flex min-w-0 flex-col gap-s-2">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-s-2 text-body">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${String(index)}`} className="flex items-center gap-s-2">
              {index === 0 ? null : (
                <span aria-hidden="true" className="text-ink-3">
                  /
                </span>
              )}
              {crumb.href === undefined ? (
                <span aria-current="page" className={cn('font-semibold text-ink', BREAK_LONG_NAMES)}>
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} prefetch={false} className={cn('text-primary-ink underline-offset-2 hover:underline', BREAK_LONG_NAMES)}>
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-s-3">
          <h1 tabIndex={-1} className="text-heading font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">
            {title}
          </h1>
          {badges}
        </div>
        {description === undefined ? null : <p className="text-ink-2">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
