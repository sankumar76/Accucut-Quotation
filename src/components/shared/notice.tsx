import { CircleCheck, CircleX, Clock, Info, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle, type AlertTone } from '@/components/ui/alert';

import { Icon } from './icon';

const TONE_ICON: Readonly<Record<AlertTone, LucideIcon>> = {
  info: Info,
  success: CircleCheck,
  warn: Clock,
  danger: CircleX,
};

/** Errors interrupt (`alert`); a saved message is polite (`status`); neutral and amber notices are plain text. */
const TONE_ROLE: Readonly<Record<AlertTone, 'alert' | 'status' | undefined>> = {
  info: undefined,
  success: 'status',
  warn: undefined,
  danger: 'alert',
};

export interface NoticeProps {
  readonly tone: AlertTone;
  /** Bold first line. Optional: a short notice can be one sentence in `children`. */
  readonly title?: string;
  readonly children?: ReactNode;
  /** Overrides the default live-region role of the tone. */
  readonly role?: 'alert' | 'status';
  readonly className?: string;
}

/**
 * A notice (UX spec section 6.0 "States", STORY-10.02 AC-5): an icon, a thick left border and written text,
 * so an error or a warning is never shown by colour alone. Danger announces itself with `role="alert"` and
 * success with `role="status"`.
 */
export function Notice({ tone, title, children, role, className }: NoticeProps) {
  const glyph = TONE_ICON[tone];
  const liveRole = role ?? TONE_ROLE[tone];
  return (
    <Alert tone={tone} role={liveRole} {...(className === undefined ? {} : { className })}>
      <Icon icon={glyph} className="mt-s-1 shrink-0" />
      <AlertDescription>
        {title === undefined ? null : <AlertTitle>{title}</AlertTitle>}
        {children}
      </AlertDescription>
    </Alert>
  );
}
