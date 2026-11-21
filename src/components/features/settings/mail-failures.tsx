import { Notice } from '@/components/shared/notice';
import type { MailFailuresView } from '@/server/services/settings-service';

import { MAIL_FAILED_TITLE, mailFailedBody } from './texts';

export interface MailFailuresProps {
  /** E-mails that failed for good in the last 7 days, or null when none did. */
  readonly failures: MailFailuresView | null;
}

/**
 * SCR-15 "E-mails not sent" (STORY-09.06 AC-8; architecture section 8, "outbox failed rows surfaced on Settings"): a warning notice with an icon, a bold title and a sentence, announced as an
 * alert like "Backup late", so it is not shown by colour alone. It says how many e-mails could not be sent in the last 7 days, when the last one failed, and the last problem in plain words
 * with "Ask Accucut IT". It shows nothing when none failed, and never an address, a subject or the class code itself. A server component: nothing on it changes in the browser.
 */
export function MailFailures({ failures }: MailFailuresProps) {
  if (failures === null) return null;
  return (
    <Notice tone="warn" role="alert" title={MAIL_FAILED_TITLE}>
      {mailFailedBody({ count: failures.count, lastCode: failures.lastCode, lastAt: new Date(failures.lastAt) })}
    </Notice>
  );
}
