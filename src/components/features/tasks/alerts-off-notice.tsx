import { Notice } from '@/components/shared/notice';

import { ALERTS_OFF_TITLE, alertsOffBody } from './assign-texts';

/**
 * The notice of SCR-04 "Assign task" when e-mail alerts are OFF (STORY-09.03 AC-6; UX-21): the Engineer chosen will not be e-mailed, and the task still appears in their queue. It shows
 * only with alerts OFF and an Engineer chosen; with alerts ON there is nothing to say. The wrapper is one polite live region that is always in the page, so a screen reader announces the
 * words when they appear (a region that is added together with its text is often not announced). The page knows only the boolean `alertsEnabled` (the Lead cannot read Settings).
 */

export interface AlertsOffNoticeProps {
  readonly alertsEnabled: boolean;
  /** The Engineer chosen in the form, or null before one is chosen. */
  readonly engineerName: string | null;
}

export function AlertsOffNotice({ alertsEnabled, engineerName }: AlertsOffNoticeProps) {
  const show = !alertsEnabled && engineerName !== null;
  return (
    <div role="status" data-alerts-off-notice="">
      {show ? (
        <Notice tone="warn" title={ALERTS_OFF_TITLE}>
          {alertsOffBody(engineerName)}
        </Notice>
      ) : null}
    </div>
  );
}
