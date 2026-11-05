import { CircleAlert } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { cn } from '@/lib/cn';

export interface FirstOpenFailureProps {
  /** The id the control names in `aria-describedby` while the line shows. */
  readonly id: string;
  readonly message: string;
  /** Which edge of the control the line lines up with. The account trigger is at the right edge of the screen. */
  readonly align: 'left' | 'right';
}

/**
 * The line under a control whose first open failed (SCR-25, UX spec 7.3.1 rule 11): the code did not arrive. It sits
 * on the control's `relative` wrapper and is positioned absolutely, so showing or hiding it moves nothing (0 px).
 * `role="alert"` announces it when it appears.
 */
export function FirstOpenFailure({ id, message, align }: FirstOpenFailureProps) {
  return (
    <div
      id={id}
      role="alert"
      className={cn(
        'absolute top-full z-(--z-popover) mt-s-1 flex w-max max-w-[min(20rem,calc(100vw-2rem))] items-start gap-s-2 rounded-md border border-danger-line border-l-4 border-l-danger bg-danger-soft px-s-3 py-s-2 text-body text-danger-ink shadow-overlay',
        align === 'right' ? 'right-0' : 'left-0',
      )}
    >
      <Icon icon={CircleAlert} size="small" className="mt-s-1 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
