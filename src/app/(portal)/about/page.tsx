import { AboutCard } from '@/components/features/about/about-card';
import { PageHeader } from '@/components/shared/page-header';
import { ABOUT_META_DESCRIPTION, ABOUT_TITLE } from '@/lib/about-text';
import { pageMetadata } from '@/lib/page-metadata';
import { authorizePage } from '@/server/http/page-access';

export const metadata = pageMetadata(ABOUT_TITLE, ABOUT_META_DESCRIPTION);

/**
 * SCR-24 "About" (STORY-01.08, FR-010): every signed-in role (manifest row `/about`, roles A L E). The page checks the manifest row first, so a signed-out
 * visitor is sent to the sign-in page. It holds no data (an Engineer may open it, NFR-002), so it reads nothing and the words are constants.
 */
export default async function AboutPage() {
  await authorizePage('/about');
  return (
    <div className="flex w-full max-w-prose flex-col gap-s-4 md:gap-s-5">
      <PageHeader title={ABOUT_TITLE} />
      <AboutCard />
    </div>
  );
}
