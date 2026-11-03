import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/**
 * shadcn/ui Alert: icon, thick left border and text (UX spec section 6.0 "States"). Four tones; the tone
 * changes colour only, so the icon and the words carry the meaning. The shared `Notice` adds the icon and the
 * live-region role.
 */
const TONE_CLASSES = {
  info: 'border-info-line border-l-info-ink bg-info-soft text-info-ink',
  success: 'border-success-line border-l-success bg-success-soft text-success-ink',
  warn: 'border-accent-line border-l-accent bg-accent-soft text-accent-ink',
  danger: 'border-danger-line border-l-danger bg-danger-soft text-danger-ink',
} as const;

export type AlertTone = keyof typeof TONE_CLASSES;

export interface AlertProps extends ComponentProps<'div'> {
  readonly tone?: AlertTone;
}

export function Alert({ tone = 'info', className, ...props }: AlertProps) {
  return (
    <div
      data-slot="alert"
      className={cn('flex items-start gap-s-3 rounded-md border border-l-4 px-s-4 py-s-3', TONE_CLASSES[tone], className)}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: ComponentProps<'p'>) {
  return <p data-slot="alert-title" className={cn('font-semibold', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="alert-description" className={cn('flex min-w-0 flex-col gap-s-1', className)} {...props} />;
}
