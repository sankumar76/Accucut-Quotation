import { HomeAction } from '@/components/features/system-pages/home-action';
import { SystemPageCard } from '@/components/features/system-pages/system-page';
import { readViewerRole } from '@/server/auth/viewer-role';

/** SCR-26 "not found" inside the portal frame, for a page that asks for `notFound()` (STORY-01.02 AC-8). It points at the menu next to it. */
export default async function PortalNotFound() {
  const role = await readViewerRole();
  return <SystemPageCard kind="not-found" hasMenu action={<HomeAction role={role} />} />;
}
