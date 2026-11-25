import Link from 'next/link';

import { FocusMainHeading } from '@/components/shared/focus-main-heading';
import { Notice } from '@/components/shared/notice';
import {
  FORGOT_PASSWORD_PATH,
  RESET_LINK_INVALID_EMAIL_OFF_BODY,
  RESET_LINK_INVALID_MESSAGE,
  RESET_LINK_INVALID_TITLE,
} from '@/lib/auth/password-reset';

export interface InvalidLinkNoticeProps {
  /** `FEATURE_EMAIL` is off (decided on the server): no link can be sent, so the notice does not offer to ask for one. */
  readonly emailOff?: boolean;
}

/**
 * The state of SCR-02 for a link that is used, expired or unknown (STORY-09.07 AC-5, AC-7): one sentence and a link to the request page, the same for all three, so it tells a person
 * holding a token nothing more. Focus moves to the heading when the page appears (as the sign-in page does for "Session ended"), so a keyboard or screen-reader user starts at what the page says.
 * While e-mail is off (STORY-01.10 AC-12, G-2b) it says the same thing about the link and then "Ask the Admin to reset your password.", with no "Ask for a new link" link: no link is ever sent.
 */
export function InvalidLinkNotice({ emailOff = false }: InvalidLinkNoticeProps) {
  return (
    <>
      <FocusMainHeading />
      {emailOff ? (
        <Notice tone="danger" title={RESET_LINK_INVALID_TITLE}>
          {RESET_LINK_INVALID_EMAIL_OFF_BODY}
        </Notice>
      ) : (
        <Notice tone="danger" title={RESET_LINK_INVALID_MESSAGE}>
          <Link href={FORGOT_PASSWORD_PATH} className="font-semibold underline underline-offset-2">
            Ask for a new link
          </Link>
        </Notice>
      )}
    </>
  );
}
