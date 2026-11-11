import { headers } from 'next/headers';

import { SignInAgainAction } from '@/components/features/system-pages/sign-in-again-action';
import { SystemPageCard } from '@/components/features/system-pages/system-page';
import { SystemPageFrame } from '@/components/features/system-pages/system-page-frame';
import { FocusMainHeading } from '@/components/shared/focus-main-heading';
import { RETURN_PATH_HEADER, SIGN_IN_PATH, signInPathFor } from '@/lib/auth/return-path';

/**
 * SCR-26 "Session ended" (STORY-01.06 AC-3). Next.js renders it, with status 401, when a page asks who is signed in and finds a
 * session that ended (`unauthorized()` in `requireUserOrRedirect`; `experimental.authInterrupts`, as for `forbidden()`). It is
 * the same for everyone and shows nothing about the page that was asked for. Its one action leads to the sign-in page and,
 * after signing in, back to that page if it is a same-origin relative path of this portal: the address is the one `proxy.ts`
 * recorded, and it goes through `signInPathFor`, so anything else is dropped.
 *
 * Heading focus: the notice is announced by its role, and focus moves to the heading once the page is interactive.
 */
export default async function Unauthorized() {
  const asked = (await headers()).get(RETURN_PATH_HEADER) ?? SIGN_IN_PATH;
  return (
    <SystemPageFrame>
      <FocusMainHeading />
      <SystemPageCard kind="session-ended" action={<SignInAgainAction href={asked === SIGN_IN_PATH ? signInPathFor(asked) : asked} />} />
    </SystemPageFrame>
  );
}
