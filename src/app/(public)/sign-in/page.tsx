import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SignInForm } from '@/components/features/auth/sign-in-form';
import { BrandLockup } from '@/components/shared/brand-lockup';
import { FocusMainHeading } from '@/components/shared/focus-main-heading';
import { Notice } from '@/components/shared/notice';
import { SkipLink } from '@/components/shared/skip-link';
import { RETURN_PARAMETER, safeReturnPath } from '@/lib/auth/return-path';
import { REASON_PARAMETER, SESSION_ENDED_NOTICE, SESSION_ENDED_REASON } from '@/lib/auth/session-ended';
import { getCurrentUser } from '@/server/auth/session';

// The layout's description and robots rules apply; the "do not index" tags for this page are story 10.03's.
export const metadata: Metadata = { title: 'Sign in' };

interface SignInPageProps {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}

/**
 * SCR-01. A person who is already signed in goes straight to where they were headed. A person sent here because their session
 * ended (`?reason=session-ended`, from a page that got the 401 `SESSION_ENDED`) is told so, as an alert, and focus moves to the
 * heading (STORY-01.06 AC-4, AC-6). Any other value of `reason` shows nothing.
 */
export default async function SignInPage({ searchParams }: SignInPageProps) {
  const query = await searchParams;
  const requested = query[RETURN_PARAMETER];
  // Only a same-origin relative path survives; anything else becomes the person's home (AC-6).
  const returnTo = safeReturnPath(typeof requested === 'string' ? requested : undefined);
  if ((await getCurrentUser()) !== null) redirect(returnTo);
  const sessionEnded = query[REASON_PARAMETER] === SESSION_ENDED_REASON;

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      {/* White like the top bar of every other page: the logo red on it is the contrast the design tokens were checked for. */}
      <header className="border-b border-border bg-surface p-s-4 md:px-s-5">
        <BrandLockup />
      </header>
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-120 flex-1 flex-col gap-s-5 px-s-4 py-s-5 outline-none md:py-s-7">
        <div className="flex flex-col gap-s-2">
          <h1 tabIndex={-1} className="text-heading font-semibold tracking-tight text-ink">
            Sign in
          </h1>
          <p className="text-ink-2">Use the e-mail and password you were given.</p>
        </div>
        {sessionEnded ? (
          <>
            <FocusMainHeading />
            <Notice tone="info" role="alert">
              {SESSION_ENDED_NOTICE}
            </Notice>
          </>
        ) : null}
        <SignInForm returnTo={returnTo} />
      </main>
      <footer className="p-s-4 text-center text-label text-ink-2">© Accucut Lasers Pvt Ltd. All rights reserved.</footer>
    </div>
  );
}
