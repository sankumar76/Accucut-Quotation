import Link from 'next/link';

import { Notice } from '@/components/shared/notice';
import { BACK_TO_SIGN_IN_TEXT, EMAIL_OFF_NOTICE_PARAGRAPHS, EMAIL_OFF_NOTICE_TITLE } from '@/lib/auth/password-reset';
import { SIGN_IN_PATH } from '@/lib/auth/return-path';

/**
 * What `/forgot-password` shows while e-mail is off, below its heading and sentence (STORY-01.10 AC-10, G-2, DEF-083): an information notice and the way back to sign-in. It has no form, no field and no
 * button, makes no request, reads no session and no account, and carries no live region (nothing changes after it loads), so it is the same for every visitor on every visit (FR-001). The link is a 44 px
 * target (NFR-017). Plain server markup: it adds no script to the page.
 */
export function EmailOffExplanation() {
  return (
    <>
      <Notice tone="info" title={EMAIL_OFF_NOTICE_TITLE}>
        {EMAIL_OFF_NOTICE_PARAGRAPHS.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </Notice>
      <p>
        <Link href={SIGN_IN_PATH} className="inline-flex min-h-(--control-h) items-center font-semibold text-primary-ink underline underline-offset-2">
          {BACK_TO_SIGN_IN_TEXT}
        </Link>
      </p>
    </>
  );
}
