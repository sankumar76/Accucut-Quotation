'use client';

import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

import { Icon } from './icon';

/** The delay before a skeleton appears (UX spec section 6.0 "States": shown after 300 ms). */
export const SKELETON_DELAY_MS = 300;

type HeadingLevel = 'h2' | 'h3' | 'h4';

export interface SkeletonBlockProps {
  /** Number of placeholder rows. */
  readonly rows?: number;
  /** Milliseconds to wait before showing the rows. 0 shows them at once. */
  readonly delayMs?: number;
  /** Read out by screen readers in a polite live region. */
  readonly label?: string;
  readonly className?: string;
}

/**
 * Loading state: grey rows shaped like the content, shown after 300 ms, in a container with
 * `aria-busy="true"`, plus a visually hidden "Loading ..." in a polite live region beside it. There is no page-level
 * spinner. The shimmer stops under `prefers-reduced-motion`.
 */
export function SkeletonBlock({ rows = 3, delayMs = SKELETON_DELAY_MS, label = 'Loading', className }: SkeletonBlockProps) {
  const [visible, setVisible] = useState(delayMs === 0);

  useEffect(() => {
    if (visible) return undefined;
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [visible, delayMs]);

  // The live region is a sibling of the busy container, not a child: a screen reader may hold back changes
  // inside an `aria-busy` subtree until it clears, and this one stays busy while it is shown (QLT-03).
  return (
    <>
      <p role="status" className="sr-only">
        {visible ? `${label} …` : ''}
      </p>
      <div aria-busy="true" className={className}>
        {visible
          ? Array.from({ length: rows }, (_, index) => (
              <div key={index} className="flex items-center gap-s-4 border-b border-border p-s-4 last:border-b-0">
                <Skeleton className="h-s-4 flex-[2]" />
                <Skeleton className="h-s-4 flex-1" />
                <Skeleton className="h-s-4 flex-1" />
              </div>
            ))
          : null}
      </div>
    </>
  );
}

export interface EmptyStateProps {
  readonly icon: ReactNode;
  /** One line. */
  readonly title: string;
  /** One sentence: what is missing and what to do. */
  readonly description: string;
  /** At most one action. */
  readonly action?: ReactNode;
  readonly as?: HeadingLevel;
  readonly className?: string;
}

/**
 * Empty state: icon, one-line title, one sentence, and one action if there is one (UX spec section 6.0). The title wraps an unbroken name
 * (`BREAK_LONG_NAMES`, "Names wrap"): a search screen puts what the person typed in it, for example `No rate matches "<text>"` (AQP-289, DEF-035).
 */
export function EmptyState({ icon, title, description, action, as: Heading = 'h2', className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-s-3 px-s-5 py-s-7 text-center', className)}>
      <span aria-hidden="true" className="flex h-s-7 w-s-7 items-center justify-center rounded-full bg-surface-2 text-ink-2">
        {icon}
      </span>
      <Heading className="text-sub font-semibold text-ink">{title}</Heading>
      <p className="max-w-prose text-ink-2">{description}</p>
      {action}
    </div>
  );
}

export interface ErrorStateProps {
  /** For example "We could not load the task queue". */
  readonly title: string;
  readonly description?: string;
  /** The "Try again" button, passed in because what it does depends on the page. */
  readonly action?: ReactNode;
  readonly as?: HeadingLevel;
  /** Move focus to the heading when the block appears (a failed page load). */
  readonly focusOnMount?: boolean;
  readonly className?: string;
}

const DEFAULT_ERROR_DESCRIPTION = 'Check your connection and try again. Nothing was changed.';

/** Error (load) state: an icon, the title, the standard reassurance and a retry action (UX spec section 6.0). */
export function ErrorState({
  title,
  description = DEFAULT_ERROR_DESCRIPTION,
  action,
  as: Heading = 'h2',
  focusOnMount = false,
  className,
}: ErrorStateProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusOnMount) headingRef.current?.focus();
  }, [focusOnMount]);

  return (
    <div className={cn('flex flex-col items-center gap-s-3 px-s-5 py-s-7 text-center', className)}>
      <span aria-hidden="true" className="flex h-s-7 w-s-7 items-center justify-center rounded-full bg-danger-soft text-danger">
        <Icon icon={TriangleAlert} size="state" />
      </span>
      <Heading ref={headingRef} tabIndex={-1} className="text-sub font-semibold text-ink">
        {title}
      </Heading>
      <p className="max-w-prose text-ink-2">{description}</p>
      {action}
    </div>
  );
}
