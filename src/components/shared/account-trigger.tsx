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

/**
 * The box around the trigger, in the plain button (`account-menu.tsx`) and around the Radix trigger (`account-menu-panel.tsx`). It is a flex item of the
 * top bar, and a flex item is never narrower than its content unless it says `min-w-0`: without it a long name (nowrap) would widen the bar and the page
 * (DEF-034). The two wrappers use this one string, so the swap on the first open changes nothing.
 */
export const ACCOUNT_WRAPPER = 'relative min-w-0';

export interface AccountTriggerProps extends ComponentProps<'button'> {
  readonly user: AccountUser;
}

/**
 * The face of the account menu button in the top bar (SCR-25): avatar, name and role from 768 px, arrow. On a phone only the
 * avatar and the arrow show; the full name stays in the accessible name. One component draws it for both the plain
 * first-load button and the Radix trigger that replaces it on the first open, so nothing changes when they swap
 * (AQP-188). It passes every other prop to the `<button>`, which is how Radix reaches it (`asChild`).
 *
 * Accessible name (DEF-014, WCAG 2.5.3 Label in Name; UX spec SCR-25): `Account menu, <initials>, <name>, <role>`, the same at
 * every width and in every state, so it always contains the visible text in the same order. The initials are the value the
 * avatar draws. Real spaces (`{' '}`) separate the text elements, so the visible text reads "EL E2E Lead Lead" and not
 * "ELE2E LeadLead"; they sit between flex items and blocks, so they draw nothing.
 *
 * Long name (DEF-034, NFR-016): the button is bounded by its wrapper (`max-w-full`; both wrappers carry `min-w-0`, see `ACCOUNT_WRAPPER`), and the
 * name box has `min-w-0`, so a name of up to 120 characters is cut with an ellipsis inside the top bar and the page never scrolls sideways. The
 * accessible name keeps the whole name. Without `min-w-0` on every flex ancestor the nowrap name sets the minimum width of the whole row.
 *
 * Pressed (UX spec 7.3.1 rule 11): the secondary look, held while the first open is pending (`aria-busy`). The
 * `enabled:aria-busy:` classes are keyed to the attribute, so they show before React has run (the early tap, DEF-013).
 */
export function AccountTrigger({ user, className, ...props }: AccountTriggerProps) {
  const initials = initialsOf(user.name);
  return (
    <button
      type="button"
      aria-label={`Account menu, ${initials}, ${user.name}, ${user.role}`}
      className={cn(
        'flex max-w-full min-h-(--control-h) cursor-pointer items-center gap-s-2 rounded-md border border-border bg-surface px-s-2 text-left transition-colors duration-200 ease-out select-none [-webkit-touch-callout:none] hover:bg-surface-2 active:bg-border active:shadow-pressed active:transition-none enabled:aria-busy:bg-border enabled:aria-busy:shadow-pressed enabled:aria-busy:transition-none md:gap-s-3 md:pr-s-3',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-s-6 w-s-6 shrink-0 items-center justify-center rounded-full bg-nav text-label font-semibold text-on-fill"
      >
        {initials}
      </span>{' '}
      <span aria-hidden="true" className="hidden min-w-0 md:block">
        <span className="block truncate font-semibold text-ink">{user.name}</span>{' '}
        <span className="block text-label text-ink-2">{user.role}</span>
      </span>
      <Icon icon={ChevronDown} size="small" className="shrink-0 text-ink-2" />
    </button>
  );
}
