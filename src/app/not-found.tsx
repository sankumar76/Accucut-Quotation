import { HomeAction, SystemPageCard } from '@/components/features/system-pages/system-page';
import { SystemPageFrame } from '@/components/features/system-pages/system-page-frame';

/**
 * SCR-26 "not found" for an address no route serves (STORY-01.02 AC-8). It sits outside the portal frame and asks nothing
 * about the visitor, so it is the same for every role and for a signed-out visitor, and answers HTTP 404.
 */
export default function NotFound() {
  return (
    <SystemPageFrame>
      <SystemPageCard kind="not-found" action={<HomeAction />} />
    </SystemPageFrame>
  );
}
