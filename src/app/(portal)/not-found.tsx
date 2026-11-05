import { HomeAction, SystemPageCard } from '@/components/features/system-pages/system-page';

/** SCR-26 "not found" inside the portal frame, for a page that asks for `notFound()` (STORY-01.02 AC-8). It points at the menu next to it. */
export default function PortalNotFound() {
  return <SystemPageCard kind="not-found" hasMenu action={<HomeAction />} />;
}
