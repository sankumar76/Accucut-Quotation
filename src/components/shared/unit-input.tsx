import type { ComponentProps } from 'react';

import { Input } from '@/components/ui/input';

export interface UnitInputProps extends ComponentProps<'input'> {
  /** The unit shown in the box after the field ("mm", "kg"). */
  readonly unit: string;
}

/**
 * An input with its unit attached on the right, as on the estimate form (SCR-00 section 06). The add-on is the **description** of the input (`aria-describedby`, after what it was already described by, an `id` of
 * its own made from the input's): a screen reader says the unit after the name and not as a part of it (AQP-482, DEF-125; WCAG 2.5.3: the unit is not the label). An input with no `id` has no such link.
 */
export function UnitInput({ unit, ...props }: UnitInputProps) {
  const unitId = props.id === undefined ? undefined : `${props.id}-unit`;
  const describedBy = [props['aria-describedby'], unitId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="group flex items-stretch">
      <Input className="rounded-r-none" {...props} aria-describedby={describedBy} />
      <span id={unitId} className="inline-flex min-w-(--control-h) items-center justify-center rounded-r-md border border-l-0 border-border-strong bg-surface-2 px-s-3 text-label whitespace-nowrap text-ink-2 group-has-[[aria-invalid=true]]:border-2 group-has-[[aria-invalid=true]]:border-l-0 group-has-[[aria-invalid=true]]:border-danger">
        {unit}
      </span>
    </div>
  );
}
