'use client';

import { CHECKPOINTS_TITLE, ERROR_TITLE } from '@/components/features/config/checkpoints-texts';
import { RouteLoadError } from '@/components/shared/route-load-error';

/**
 * SCR-21 "Error" for a page that failed while it rendered (STORY-10.07 AC-4). The screen's own read of the checkpoints has its own error state in the card
 * (`checkpoints-screen.tsx`); this is the route-level boundary under it. Nothing was changed; "Try again" asks the server again.
 */
export default function CheckpointsError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <RouteLoadError pageTitle={CHECKPOINTS_TITLE} title={ERROR_TITLE} reset={reset} />;
}
