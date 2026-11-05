import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Icon } from '@/components/shared/icon';
import { cn } from '@/lib/cn';
import { initialsOf } from '@/lib/initials';

export interface AccountUser {
  readonly name: string;
  readonly email: string;
  readonly role: string;
}

export interface AccountTriggerProps extends ComponentProps<'button'> {
  readonly user: AccountUser;
}

/**
 * The face of the account menu button in the top bar (SCR-25): avatar, name and role from 768 px, arrow. On a phone only the
 * avatar and the arrow show; the full name stays in the accessible name. One component draws it for both the plain
 * first-load button and the Radix trigger that replaces it on the first open, so nothing changes when they swap
 * (AQP-188). It passes every other prop to the `<button>`, which is how Radix reaches it (`asChild`).
 *
 * Pressed (UX spec 7.3.1 rule 11): the secondary look, held while the first open is pending (`aria-busy`). The
 * `enabled:aria-busy:` classes are keyed to the attribute, so they show before React has run (the early tap, DEF-013).
 */
export function AccountTrigger({ user, className, ...props }: AccountTriggerProps) {
  return (
    <button
      type="button"
      aria-label={`Account menu, ${user.name}, ${user.role}`}
      className={cn(
        'flex min-h-(--control-h) cursor-pointer items-center gap-s-2 rounded-md border border-border bg-surface px-s-2 text-left transition-colors duration-200 ease-out select-none [-webkit-touch-callout:none] hover:bg-surface-2 active:bg-border active:shadow-pressed active:transition-none enabled:aria-busy:bg-border enabled:aria-busy:shadow-pressed enabled:aria-busy:transition-none md:gap-s-3 md:pr-s-3',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-s-6 w-s-6 shrink-0 items-center justify-center rounded-full bg-nav text-label font-semibold text-on-fill"
      >
        {initialsOf(user.name)}
      </span>
      <span aria-hidden="true" className="hidden min-w-0 md:block">
        <span className="block truncate font-semibold text-ink">{user.name}</span>
        <span className="block text-label text-ink-2">{user.role}</span>
      </span>
      <Icon icon={ChevronDown} size="small" className="shrink-0 text-ink-2" />
    </button>
  );
}
