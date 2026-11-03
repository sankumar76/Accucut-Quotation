import type { ComponentProps } from 'react';

import { Input } from '@/components/ui/input';

export interface UnitInputProps extends ComponentProps<'input'> {
  /** The unit shown in the box after the field ("mm", "kg"). */
  readonly unit: string;
}

/** An input with its unit attached on the right, as on the estimate form (SCR-00 section 06). */
export function UnitInput({ unit, ...props }: UnitInputProps) {
  return (
    <div className="group flex items-stretch">
      <Input className="rounded-r-none" {...props} />
      <span className="inline-flex min-w-(--control-h) items-center justify-center rounded-r-md border border-l-0 border-border-strong bg-surface-2 px-s-3 text-label whitespace-nowrap text-ink-2 group-has-[[aria-invalid=true]]:border-2 group-has-[[aria-invalid=true]]:border-l-0 group-has-[[aria-invalid=true]]:border-danger">
        {unit}
      </span>
    </div>
  );
}
