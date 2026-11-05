import 'server-only';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { HOME_PATH } from '@/lib/auth/return-path';
import { homeActionLabel, type RoleName } from '@/lib/auth/roles';

/**
 * The one action of the "no access" and "not found" pages: a link to the person's own landing page, the queue (SCR-03),
 * named as the menu names it (`homeActionLabel`). It takes the viewer's role and nothing else, so the page is identical for
 * everyone of that role whatever address was asked for (UX-22, AC-8).
 *
 * `server-only` keeps it, and the shared `Button` and `next/link` it needs, out of the error boundary: `app/error.tsx` is a
 * client component that every page loads, and it must not pull these in (PRF-01, NFR-009). Only the not-found and
 * forbidden pages import this module.
 */
export function HomeAction({ role }: Readonly<{ role: RoleName | null }>) {
  return (
    <Button asChild>
      <Link href={HOME_PATH}>{homeActionLabel(role)}</Link>
    </Button>
  );
}
