import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { Label } from '@/components/ui/label';

import { Icon } from './icon';

/** What the control must receive so the label, hint and error are tied to it for assistive technology. */
export interface FieldControlProps {
  readonly id: string;
  readonly 'aria-describedby': string | undefined;
  readonly 'aria-invalid': true | undefined;
}

export interface FormFieldProps {
  /** Unique on the page; the control gets it as its `id`. */
  readonly id: string;
  readonly label: string;
  /** Shown beside the label, for example a column tag. */
  readonly tag?: ReactNode;
  readonly hint?: string;
  /** The error message. Its presence sets `aria-invalid` on the control and shows the icon and the text. */
  readonly error?: string;
  readonly children: (control: FieldControlProps) => ReactNode;
}

/**
 * One label above each field, the hint below it in label size, then the error in the error red with an
 * alert icon (UX spec section 6.0 "Forms"). The control is created by the caller from the props this passes
 * in, so `aria-describedby` and `aria-invalid` are always wired.
 */
export function FormField({ id, label, tag, hint, error, children }: FormFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint === undefined ? undefined : hintId, error === undefined ? undefined : errorId]
    .filter((value): value is string => value !== undefined)
    .join(' ');

  return (
    <div className="flex min-w-0 flex-col gap-s-2">
      <Label htmlFor={id}>
        {label}
        {tag}
      </Label>
      {children({
        id,
        'aria-describedby': describedBy === '' ? undefined : describedBy,
        'aria-invalid': error === undefined ? undefined : true,
      })}
      {hint === undefined ? null : (
        <p id={hintId} className="text-label text-ink-3">
          {hint}
        </p>
      )}
      {error === undefined ? null : (
        <p id={errorId} className="flex items-start gap-s-1 text-label font-semibold text-danger">
          <Icon icon={CircleAlert} size="hint" className="mt-px shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
