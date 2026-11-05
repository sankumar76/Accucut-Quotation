import { HomeAction } from '@/components/features/system-pages/home-action';
import { SystemPageCard } from '@/components/features/system-pages/system-page';
import { SystemPageFrame } from '@/components/features/system-pages/system-page-frame';
import { readViewerRole } from '@/server/auth/viewer-role';

/**
 * SCR-26 "not found" for an address no route serves (STORY-01.02 AC-8), HTTP 404. The page is the same whatever address was
 * asked for; only the label of its button follows the viewer's role (UX spec v0.12), and a role that cannot be read gives the
 * neutral "Go to the task list".
 */
export default async function NotFound() {
  const role = await readViewerRole();
  return (
    <SystemPageFrame>
      <SystemPageCard kind="not-found" action={<HomeAction role={role} />} />
    </SystemPageFrame>
  );
}
