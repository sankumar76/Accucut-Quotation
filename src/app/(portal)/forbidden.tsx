import { HomeAction, SystemPageCard } from '@/components/features/system-pages/system-page';

/**
 * SCR-26 "no access" inside the portal frame (STORY-01.02 AC-4 and AC-8). Next.js renders it, with status 403, when a page
 * calls `forbidden()` through `authorizePage`. It takes no input, so it is identical for every role and for every page that
 * was asked for: it never says what the page holds or whether it exists (UX-22, CR-33).
 */
export default function Forbidden() {
  return <SystemPageCard kind="forbidden" action={<HomeAction />} />;
}
