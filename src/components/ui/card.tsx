import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/** shadcn/ui Card: white surface, 1 px border, 12 px radius, the one card shadow. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card" className={cn('min-w-0 rounded-lg border border-border bg-surface shadow-card', className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex flex-wrap items-center gap-s-3 border-b border-border px-s-4 py-s-4 md:px-s-5', className)}
      {...props}
    />
  );
}

export interface CardTitleProps extends ComponentProps<'h2'> {
  /** The heading level to render; cards on a page sit under its single h1, so the default is h2. */
  readonly as?: 'h2' | 'h3' | 'h4';
}

export function CardTitle({ as: Heading = 'h2', className, ...props }: CardTitleProps) {
  return <Heading data-slot="card-title" className={cn('text-sub font-semibold text-ink', className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('p-s-4 md:p-s-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex flex-wrap items-center gap-s-3 border-t border-border px-s-4 py-s-4 md:px-s-5', className)}
      {...props}
    />
  );
}
