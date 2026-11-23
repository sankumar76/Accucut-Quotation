import { Notice } from '@/components/shared/notice';
import { formatIst } from '@/lib/time';

import { IGNORED_NOTICE_ID } from './ignore-ids';
import { ENGINEER_NOTICE_BODY, engineerNoticeTitle, REMARKS_PREFIX } from './ignore-texts';

/**
 * The Engineer's notice of an ignored task on SCR-05 (CR-01 item 7D, AQP-401 AC-8; UX 12944 section 4): who ignored it, when (IST) and the Lead's remarks with their line breaks kept, and that nothing here can be
 * changed. **Server-rendered static markup**: it is a server component with no script, drawn at first paint and handed to the client form as an element (`EstimateWorkspace` takes it as `children`-style content), so it
 * adds no client code to `/estimates/[code]` (NFR-009, ADR-016). It is **not** the notice of SCR-06: those words speak of Restore and of downloads, which an Engineer cannot do, and it has no Restore. The remarks are the
 * Lead's own text, drawn as a text node (`<b>x</b>` shows as typed). It does not name the status underneath. No figure, rate or formula is anywhere in it (NFR-002).
 */

export interface EngineerIgnoredNoticeProps {
  /** The layer as the server read it: when it was set (UTC text), by whom (a name) and the remarks. */
  readonly ignored: { readonly at: string; readonly byName: string; readonly remarks: string };
}

export function EngineerIgnoredNotice({ ignored }: EngineerIgnoredNoticeProps) {
  return (
    <div id={IGNORED_NOTICE_ID} tabIndex={-1} className="rounded-md">
      <Notice tone="warn" role="status" title={engineerNoticeTitle(formatIst(new Date(ignored.at)), ignored.byName)}>
        <p className="whitespace-pre-wrap" data-ignored-remarks="">
          <span className="font-semibold">{REMARKS_PREFIX}</span>
          {ignored.remarks}
        </p>
        <p className="mt-s-2">{ENGINEER_NOTICE_BODY}</p>
      </Notice>
    </div>
  );
}
