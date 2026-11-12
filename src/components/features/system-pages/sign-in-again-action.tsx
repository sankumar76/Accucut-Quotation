import 'server-only';

import Link from 'next/link';

import { Button } from '@/components/ui/button';

/**
 * The one action of the "Session ended" page (STORY-01.06 AC-3): a link to the sign-in page, which brings the person back to the
 * page they asked for after they sign in. The address is already checked (`signInPathFor`), so this only draws the link.
 *
 * `server-only` for the same reason as `home-action.tsx`: the shared `Button` and `next/link` stay out of the client error
 * boundary, which imports `system-page.tsx` (PRF-01, NFR-009). Only `app/unauthorized.tsx` imports this module.
 */
export function SignInAgainAction({ href }: Readonly<{ href: string }>) {
  return (
    <Button asChild>
      <Link href={href}>Sign in again</Link>
    </Button>
  );
}
