import { Notice } from '@/components/shared/notice';
import { formatIst } from '@/lib/time';

import { IGNORED_NOTICE_ID } from './ignore-ids';
import { ignoredNoticeBody, ignoredNoticeTitle, REMARKS_PREFIX, type RestoreFacts } from './ignore-texts';
import { RestoreButton } from './restore-button';

/**
 * The Lead's and the Admin's notice of an ignored estimate on SCR-06 (CR-01 item 7D, AQP-401 AC-8; UX 12944 section 2): who ignored it, when (IST), the remarks with their line breaks kept, that the estimate is read-only
 * until it is restored, which status Restore puts back, and **Restore RFQ**, the one action left on the page. A server component: the words are drawn at first paint (ADR-016), and the one script is the small button that
 * opens the dialog. The remarks are the Lead's own text, drawn as a text node (`<b>x</b>` shows as typed). It takes focus when a person is going to it (`tabIndex` -1). No figure is anywhere in it (NFR-002).
 */

export interface IgnoredNoticeProps extends RestoreFacts {
  /** The layer as the server read it: when it was set (UTC text), by whom (a name) and the remarks. */
  readonly ignored: { readonly at: string; readonly byName: string; readonly remarks: string };
  readonly estimateId: string;
  readonly code: string;
  readonly restoreButtonId: string;
  /** The words of the button and of its failure line: the review's, passed in, so this folder imports none of the review's files. */
  readonly restoreLabel: string;
  readonly restoreFailedLine: string;
}

export function IgnoredNotice({ ignored, estimateId, code, restoreButtonId, restoreLabel, restoreFailedLine, ...facts }: IgnoredNoticeProps) {
  return (
    <div id={IGNORED_NOTICE_ID} tabIndex={-1} className="rounded-md">
      <Notice tone="warn" role="status" title={ignoredNoticeTitle(formatIst(new Date(ignored.at)), ignored.byName)}>
        <p className="whitespace-pre-wrap" data-ignored-remarks="">
          <span className="font-semibold">{REMARKS_PREFIX}</span>
          {ignored.remarks}
        </p>
        <p className="mt-s-2">{ignoredNoticeBody(facts.status)}</p>
        <div className="mt-s-3">
          <RestoreButton
            id={restoreButtonId}
            label={restoreLabel}
            failedLine={restoreFailedLine}
            estimateId={estimateId}
            code={code}
            status={facts.status}
            engineerName={facts.engineerName}
            deadlineLabel={facts.deadlineLabel}
            deadlinePassed={facts.deadlinePassed}
          />
        </div>
      </Notice>
    </div>
  );
}
