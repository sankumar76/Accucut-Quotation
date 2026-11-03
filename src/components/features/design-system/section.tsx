import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';

export interface DsSectionProps {
  /** Two-digit section number as on SCR-00 ("01"). */
  readonly number: string;
  readonly id: string;
  readonly title: string;
  /** Short text on the right of the heading. */
  readonly aside?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}

/** One numbered section card of the design-system page (SCR-00): the number tag, an h2 and the body. */
export function DsSection({ number, id, title, aside, className, children }: DsSectionProps) {
  return (
    <section aria-labelledby={id} className={cn('min-w-0', className)}>
      <Card>
        <CardHeader>
          <span
            aria-hidden="true"
            className="inline-flex h-s-6 w-s-6 shrink-0 items-center justify-center rounded-md bg-nav font-mono text-label text-on-fill"
          >
            {number}
          </span>
          <CardTitle id={id}>{title}</CardTitle>
          {aside === undefined ? null : <div className="ml-auto text-label text-ink-2">{aside}</div>}
        </CardHeader>
        <CardContent className="flex flex-col gap-s-5">{children}</CardContent>
      </Card>
    </section>
  );
}
