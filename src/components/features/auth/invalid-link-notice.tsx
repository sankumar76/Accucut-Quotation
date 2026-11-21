import Link from 'next/link';

import { FocusMainHeading } from '@/components/shared/focus-main-heading';
import { Notice } from '@/components/shared/notice';
import { FORGOT_PASSWORD_PATH, RESET_LINK_INVALID_MESSAGE } from '@/lib/auth/password-reset';

/**
 * The state of SCR-02 for a link that is used, expired or unknown (STORY-09.07 AC-5, AC-7): one sentence and a link to the request page, the same for all three, so it tells a person
 * holding a token nothing more. Focus moves to the heading when the page appears (as the sign-in page does for "Session ended"), so a keyboard or screen-reader user starts at what the page says.
 */
export function InvalidLinkNotice() {
  return (
    <>
      <FocusMainHeading />
      <Notice tone="danger" title={RESET_LINK_INVALID_MESSAGE}>
        <Link href={FORGOT_PASSWORD_PATH} className="font-semibold underline underline-offset-2">
          Ask for a new link
        </Link>
      </Notice>
    </>
  );
}
