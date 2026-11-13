import type { ReactNode } from 'react';

export interface PageHeaderProps {
  /** The page title: the only `h1` on the page. */
  readonly title: string;
  readonly description?: string;
  /** Actions on the right (on a new line on a phone). */
  readonly actions?: ReactNode;
}

/**
 * Page title and one-line description at the top of `main` (UX spec section 6.0 "Page frame"). The title always wraps a long name (6.0 "Names wrap"), so a
 * record page whose title is a name typed by a person never scrolls sideways (AQP-142, DEF-031). The class is written here until it joins the shared
 * constant of GitHub issue 225; a caller adds nothing.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-s-4">
      <div className="flex min-w-0 flex-col gap-s-2">
        <h1 tabIndex={-1} className="text-heading font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">{title}</h1>
        {description === undefined ? null : <p className="max-w-prose text-ink-2">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
