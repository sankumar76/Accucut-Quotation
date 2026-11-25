import { EmailOffExplanation } from '@/components/features/auth/email-off-explanation';
import { ForgotPasswordForm } from '@/components/features/auth/forgot-password-form';
import { PublicPageFrame } from '@/components/features/auth/public-page-frame';
import { FORGOT_DESCRIPTION, FORGOT_EMAIL_OFF_LEAD, FORGOT_TITLE } from '@/lib/auth/password-reset';
import { loadEmailFeature } from '@/lib/env';
import { PRODUCT_NAME_IN_A_SENTENCE } from '@/lib/product-name';
import { pageMetadata } from '@/lib/page-metadata';

// The layout's description and robots rules apply (`noindex, nofollow`); the page adds its own words and no image.
export const metadata = pageMetadata('Forgot your password', `Ask for a link to choose a new password for the Accucut Lasers ${PRODUCT_NAME_IN_A_SENTENCE}.`);

// The page reads `FEATURE_EMAIL` on every request (STORY-01.10 AC-10c, UX-AC-G2.5), so switching e-mail on and restarting the services shows the form with no new build. Without this Next.js could build the
// page once, with the setting of the build machine in it.
export const dynamic = 'force-dynamic';

/**
 * SCR-02, the request (STORY-09.07 AC-1, AC-2; STORY-01.10 AC-10, DEF-083): public, because the person cannot sign in. It is open to a signed-in person too and never says whether an e-mail address is registered.
 * With e-mail on it is the form and its one fixed answer. With e-mail off no link can be sent, so the form is not rendered at all: the page tells the truth ("Ask the Admin to reset it.") instead of
 * promising a link. The server decides, like the sign-in page, from the same setting; the page reads no session and no account, takes no input (a `?mail=on` does nothing), and makes no request, so it is
 * the same for everyone (FR-001). The route behind the form (`POST /api/v1/account/password/forgot`) is not changed: it still answers every address alike.
 */
export default function ForgotPasswordPage() {
  if (!loadEmailFeature()) {
    return (
      <PublicPageFrame title={FORGOT_TITLE} description={FORGOT_EMAIL_OFF_LEAD}>
        <EmailOffExplanation />
      </PublicPageFrame>
    );
  }
  return (
    <PublicPageFrame title={FORGOT_TITLE} description={FORGOT_DESCRIPTION}>
      <ForgotPasswordForm />
    </PublicPageFrame>
  );
}
