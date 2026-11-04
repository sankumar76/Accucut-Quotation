import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SignInForm } from '@/components/features/auth/sign-in-form';
import { BrandLockup } from '@/components/shared/brand-lockup';
import { SkipLink } from '@/components/shared/skip-link';
import { RETURN_PARAMETER, safeReturnPath } from '@/lib/auth/return-path';
import { getCurrentUser } from '@/server/auth/session';

// The layout's description and robots rules apply; the "do not index" tags for this page are story 10.03's.
export const metadata: Metadata = { title: 'Sign in' };

interface SignInPageProps {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}

/** SCR-01. A person who is already signed in goes straight to where they were headed. */
export default async function SignInPage({ searchParams }: SignInPageProps) {
  const requested = (await searchParams)[RETURN_PARAMETER];
  // Only a same-origin relative path survives; anything else becomes the person's home (AC-6).
  const returnTo = safeReturnPath(typeof requested === 'string' ? requested : undefined);
  if ((await getCurrentUser()) !== null) redirect(returnTo);

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="p-s-4 md:px-s-5">
        <BrandLockup />
      </header>
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-120 flex-1 flex-col gap-s-5 px-s-4 py-s-5 outline-none md:py-s-7">
        <div className="flex flex-col gap-s-2">
          <h1 className="text-heading font-semibold tracking-tight text-ink">Sign in</h1>
          <p className="text-ink-2">Use the e-mail and password you were given.</p>
        </div>
        <SignInForm returnTo={returnTo} />
      </main>
      <footer className="p-s-4 text-center text-label text-ink-2">© Accucut Lasers Pvt Ltd. All rights reserved.</footer>
    </div>
  );
}
