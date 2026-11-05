import { SystemPageCard } from '@/components/features/system-pages/system-page';
import { HomeAction } from '@/components/features/system-pages/home-action';
import { readViewerRole } from '@/server/auth/viewer-role';

/**
 * SCR-26 "no access" inside the portal frame (STORY-01.02 AC-4 and AC-8). Next.js renders it, with status 403, when a page
 * calls `forbidden()` through `authorizePage`. It reads nothing about the page that was asked for: the card is the same
 * for every address, and only the button's label follows the viewer's role (UX spec v0.12, UX-22, CR-33).
 */
export default async function Forbidden() {
  const role = await readViewerRole();
  return <SystemPageCard kind="forbidden" action={<HomeAction role={role} />} />;
}
