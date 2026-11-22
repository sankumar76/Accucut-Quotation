import type { ReactNode } from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';

import { BREAK_LONG_NAMES } from './break-long-names';

export interface ReadOnlyFieldProps {
  /** Unique on the page; the output gets it as its `id`, so the label is tied to it. */
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  /** The value shown. Empty while there is nothing to show. */
  readonly children: ReactNode;
  /** The value is code-like (a short name): the monospace face. */
  readonly mono?: boolean;
}

/**
 * A value the person reads and cannot change, with its visible label (CR-01 item 6: "Customer Short Name" on SCR-04). It is an `<output>`, a labelable element, and not a disabled input: the text is
 * read by assistive technology under its label, and a change of the value (a new customer chosen) is announced, since an output is a live region. The look is the dashed, grey one of the shared Input's
 * read-only state, at the same height, so it sits in a form like the fields around it.
 */
export function ReadOnlyField({ id, label, hint, children, mono = false }: ReadOnlyFieldProps) {
  const hintId = `${id}-hint`;
  return (
    <div className="flex min-w-0 flex-col gap-s-2">
      <Label htmlFor={id}>{label}</Label>
      <output
        id={id}
        {...(hint === undefined ? {} : { 'aria-describedby': hintId })}
        className={cn(
          'flex min-h-(--control-h) w-full min-w-0 items-center rounded-md border border-dashed border-border-strong bg-surface-2 px-s-3 text-body text-ink-2',
          mono ? 'font-mono' : null,
          BREAK_LONG_NAMES,
        )}
      >
        {children}
      </output>
      {hint === undefined ? null : (
        <p id={hintId} className="text-label text-ink-3">
          {hint}
        </p>
      )}
    </div>
  );
}
