import { ForgotPasswordForm } from '@/components/features/auth/forgot-password-form';
import { PublicPageFrame } from '@/components/features/auth/public-page-frame';
import { FORGOT_DESCRIPTION, FORGOT_TITLE } from '@/lib/auth/password-reset';
import { pageMetadata } from '@/lib/page-metadata';

// The layout's description and robots rules apply (`noindex, nofollow`); the page adds its own words and no image.
export const metadata = pageMetadata('Forgot your password', 'Ask for a link to choose a new password for the Accucut Lasers quotation portal.');

/**
 * SCR-02, the request (STORY-09.07 AC-1, AC-2): public, because the person cannot sign in. It is open to a signed-in person too and never says whether an e-mail address is registered.
 * The page itself reads no session and no setting, so it is the same for everyone; whether the e-mail can really be sent is the server's (`FEATURE_EMAIL`, decision D-1).
 */
export default function ForgotPasswordPage() {
  return (
    <PublicPageFrame title={FORGOT_TITLE} description={FORGOT_DESCRIPTION}>
      <ForgotPasswordForm />
    </PublicPageFrame>
  );
}
