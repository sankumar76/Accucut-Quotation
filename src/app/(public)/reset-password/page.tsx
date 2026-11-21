import { InvalidLinkNotice } from '@/components/features/auth/invalid-link-notice';
import { PublicPageFrame } from '@/components/features/auth/public-page-frame';
import { ResetPasswordForm } from '@/components/features/auth/reset-password-form';
import { RESET_DESCRIPTION, RESET_TITLE, RESET_TOKEN_PARAMETER } from '@/lib/auth/password-reset';
import { pageMetadata } from '@/lib/page-metadata';
import { getPasswordResetService } from '@/server/composition';

// The layout's description and robots rules apply (`noindex, nofollow`); this page's address carries a token, so it also has `Referrer-Policy: no-referrer` and `no-store` (`next.config.ts`).
export const metadata = pageMetadata('Choose a new password', 'Choose a new password for the Accucut Lasers quotation portal with the link you were e-mailed.');

interface ResetPasswordPageProps {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}

/**
 * SCR-02, the reset (STORY-09.07 AC-5): public, opened from the e-mailed link. A link that works shows New password and Repeat; a link that is used, expired or unknown, a missing token and a
 * token of the wrong shape all show the same sentence and a link to ask for a new one, so the page says nothing about why. The read claims nothing: the token is claimed only by the post. The
 * token goes to the form as a prop and is never logged, echoed in text or sent anywhere but the reset request. No script or image comes from another site.
 */
export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const requested = (await searchParams)[RESET_TOKEN_PARAMETER];
  const token = typeof requested === 'string' ? requested : '';
  const usable = token !== '' && (await getPasswordResetService().isLinkUsable(token));
  return (
    <PublicPageFrame title={RESET_TITLE} description={RESET_DESCRIPTION}>
      {usable ? <ResetPasswordForm token={token} /> : <InvalidLinkNotice />}
    </PublicPageFrame>
  );
}
